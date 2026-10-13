import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'
import {
	handleAccountPackageInternetVisibleAction,
	loadAccountPackageApproveCapabilitiesData,
} from '#app/account-package-capability-approval.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadPackagePage } from '#app/package-page.ts'
import { routes } from '#universal/routes.ts'

const communityPackageMatcher = createMatcher(routes.communityPackage.pattern)

function readPackageId(params: unknown): string | null {
	if (
		typeof params === 'object' &&
		params !== null &&
		'packageId' in params &&
		typeof params.packageId === 'string' &&
		params.packageId.trim()
	) {
		return params.packageId.trim()
	}
	return null
}

function readCanonicalPackageParams(
	params: unknown,
): { username: string; kodyId: string } | null {
	if (
		typeof params !== 'object' ||
		params === null ||
		!('username' in params) ||
		typeof params.username !== 'string' ||
		!('kodyId' in params) ||
		typeof params.kodyId !== 'string'
	) {
		return null
	}
	return { username: params.username, kodyId: params.kodyId }
}

function redirectToCanonicalApprovalApi(input: {
	request: Request
	packageHref: string
}) {
	const match = communityPackageMatcher.match(
		new URL(input.packageHref, input.request.url),
	)
	if (!match) return null
	const requestUrl = new URL(input.request.url)
	const destination = new URL(
		routes.communityPackageApproveCapabilitiesApi.href({
			username: match.params.username,
			kodyId: match.params.kodyId,
		}),
		requestUrl,
	)
	destination.search = requestUrl.search
	return new Response(null, {
		status: 302,
		headers: {
			location: destination.toString(),
			'cache-control': 'private, no-store',
		},
	})
}

async function resolveApproveCapabilitiesPackageId(input: {
	env: Env
	request: Request
	params: unknown
	allowRedirect: boolean
}): Promise<
	{ ok: true; packageId: string } | { ok: false; response: Response }
> {
	let packageId = readPackageId(input.params)
	if (packageId) return { ok: true, packageId }

	const canonicalParams = readCanonicalPackageParams(input.params)
	if (!canonicalParams) {
		return {
			ok: false,
			response: jsonResponse(
				{ ok: false, error: 'Package id is required.' },
				400,
			),
		}
	}

	const page = await loadPackagePage({
		env: input.env,
		request: input.request,
		username: canonicalParams.username,
		kodyId: canonicalParams.kodyId,
	})
	if (page.kind === 'redirect') {
		if (input.allowRedirect) {
			const redirect = redirectToCanonicalApprovalApi({
				request: input.request,
				packageHref: page.to,
			})
			if (redirect) return { ok: false, response: redirect }
		}
		// Follow one rename hop without returning 302 so POST can still write.
		const match = communityPackageMatcher.match(
			new URL(page.to, input.request.url),
		)
		if (match) {
			const again = await loadPackagePage({
				env: input.env,
				request: input.request,
				username: match.params.username,
				kodyId: match.params.kodyId,
			})
			if (
				again.kind === 'page' &&
				again.viewerCanManage &&
				again.ownerPackage
			) {
				return { ok: true, packageId: again.ownerPackage.id }
			}
		}
		return {
			ok: false,
			response: jsonResponse(
				{
					ok: false,
					error: 'Package URL changed. Reload the approval page and try again.',
				},
				409,
			),
		}
	}
	if (page.kind === 'page' && page.viewerCanManage && page.ownerPackage) {
		return { ok: true, packageId: page.ownerPackage.id }
	}
	return {
		ok: false,
		response: jsonResponse({ ok: false, error: 'Package not found.' }, 404),
	}
}

export function createAccountPackageApproveCapabilitiesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'POST') {
				const body = await request.json().catch(() => null)
				if (!body || typeof body !== 'object' || Array.isArray(body)) {
					return jsonResponse(
						{ ok: false, error: 'Invalid request body.' },
						400,
					)
				}
				const packageId = await resolveApproveCapabilitiesPackageId({
					env,
					request,
					params,
					// POSTs must not 302: fetch follows as GET and the client
					// treats the summary payload as a successful approve.
					allowRedirect: false,
				})
				if (!packageId.ok) return packageId.response
				const response = await handleAccountPackageInternetVisibleAction({
					env,
					request,
					user,
					body: {
						...body,
						// URL package wins: collaborators must approve the page they reviewed.
						action:
							'action' in body && body.action === 'approve-credential-needs'
								? 'approve-credential-needs'
								: 'approve-capabilities',
						packageId: packageId.packageId,
					},
				})
				return (
					response ??
					jsonResponse({ ok: false, error: 'Unsupported action.' }, 400)
				)
			}

			if (request.method !== 'GET') {
				return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const packageId = await resolveApproveCapabilitiesPackageId({
				env,
				request,
				params,
				allowRedirect: true,
			})
			if (!packageId.ok) return packageId.response
			const payload = await loadAccountPackageApproveCapabilitiesData({
				env,
				request,
				user,
				packageId: packageId.packageId,
			})
			if (!payload.ok) {
				return jsonResponse(payload, 404)
			}
			return jsonResponse(payload)
		},
	} satisfies Action<
		| typeof routes.accountPackageApproveCapabilitiesApi
		| typeof routes.communityPackageApproveCapabilitiesApi
	>
}

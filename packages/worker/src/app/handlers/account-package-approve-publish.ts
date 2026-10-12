import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { createMatcher } from 'remix/route-pattern/match'
import { loadAccountPackageApprovePublishData } from '#app/account-package-publish-lock.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadPackagePage } from '#app/package-page.ts'
import { routes } from '#universal/routes.ts'

const communityPackageMatcher = createMatcher(routes.communityPackage.pattern)

export function readPackageId(params: unknown): string | null {
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

export function readCanonicalPackageParams(
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

export function redirectToCanonicalApproval(input: {
	request: Request
	username: string
	kodyId: string
}) {
	const requestUrl = new URL(input.request.url)
	const destination = new URL(
		routes.communityPackageApprovePublish.href({
			username: input.username,
			kodyId: input.kodyId,
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
		routes.communityPackageApprovePublishApi.href({
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

export function createAccountPackageApprovePublishApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}
			if (request.method !== 'GET') {
				return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
			}
			let packageId = readPackageId(params)
			const canonicalParams = readCanonicalPackageParams(params)
			if (!packageId && canonicalParams) {
				const page = await loadPackagePage({
					env,
					request,
					username: canonicalParams.username,
					kodyId: canonicalParams.kodyId,
				})
				if (page.kind === 'redirect') {
					const redirect = redirectToCanonicalApprovalApi({
						request,
						packageHref: page.to,
					})
					if (redirect) return redirect
				}
				if (page.kind === 'page' && page.viewerCanManage && page.ownerPackage) {
					packageId = page.ownerPackage.id
				}
			}
			if (!packageId) {
				return jsonResponse(
					{ ok: false, error: 'Package id is required.' },
					400,
				)
			}
			const payload = await loadAccountPackageApprovePublishData({
				env,
				request,
				user,
				packageId,
			})
			if (!payload.ok) {
				return jsonResponse(payload, 404)
			}
			return jsonResponse(payload)
		},
	} satisfies Action<
		| typeof routes.accountPackageApprovePublishApi
		| typeof routes.communityPackageApprovePublishApi
	>
}

import { type Action } from 'remix/router'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadRequestOrgResolution } from '#app/org-request-binding.ts'
import {
	authorize,
	AuthorizationError,
	canSeeResource,
	computeEffectivePermissions,
	packageResource,
} from '#worker/authorization/authorize.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { loadConnectionUsage } from '#worker/usage/connection-usage.ts'
import { type routes } from '#universal/routes.ts'

/**
 * Org-wide usage (other people, Automation) is billing data: owners and
 * billing admins see it. Everyone else sees only their own connections.
 */
async function canReadOrgWideUsage(
	env: Env,
	request: Parameters<typeof authorize>[0]['request'],
) {
	try {
		await authorize({ env, request }, 'billing:read')
		return true
	} catch (error) {
		if (error instanceof AuthorizationError) return false
		throw error
	}
}

export function createAccountConnectionUsageApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			return readAccountConnectionUsage(request, env)
		},
	} satisfies Action<typeof routes.accountConnectionUsageApi>
}

export async function readAccountConnectionUsage(request: Request, env: Env) {
	const result = await loadAccountConnectionUsageData(request, env)
	return result.status === 200
		? jsonResponse(result.data)
		: jsonResponse({ ok: false, error: result.error }, result.status)
}

export async function loadAccountConnectionUsageData(
	request: Request,
	env: Env,
) {
	const user = await readAuthenticatedAppUser(request, env)
	if (!user) {
		return { status: 401 as const, error: 'Unauthorized.' }
	}
	const resolution = await loadRequestOrgResolution(
		request,
		env,
		user.mcpUser.userId,
	)
	if (resolution === 'denied') {
		return { status: 404 as const, error: 'Organization not found.' }
	}
	const orgId = ownerIdFromCaller({
		request: user.request,
		user: user.mcpUser,
	})
	const access = await computeEffectivePermissions({
		env,
		request: user.request,
	})
	return {
		status: 200 as const,
		data: await loadConnectionUsage({
			env,
			orgId,
			orgSlug: user.request.org.slug ?? user.username,
			viewerPersonId: user.mcpUser.userId,
			includeOrgWide: await canReadOrgWideUsage(env, user.request),
			canSeePackage: (packageId) =>
				canSeeResource(
					access,
					packageResource({ id: packageId, userId: orgId }),
				),
		}),
	}
}

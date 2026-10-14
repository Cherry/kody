import {
	isOrgBoundRequest,
	isOrgRequestDenied,
} from '#app/org-request-binding.ts'
import { loadResolvedRequestAuth } from './request-auth-cache.ts'

/** Authorization policy shared by native Start document and protocol boundaries. */
export async function orgRequestIsDenied(
	request: Request,
	env: Env,
): Promise<boolean> {
	if (!isOrgBoundRequest(new URL(request.url))) return false
	const auth = await loadResolvedRequestAuth(request, env)
	if (!auth.user || auth.user.accountSuspended) return false
	return isOrgRequestDenied(request, env, auth.user.mcpUser.userId)
}

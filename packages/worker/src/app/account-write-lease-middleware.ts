import { personalOrgIdForPerson } from '#worker/orgs/personal-org-id.ts'
import {
	AccountDeletionInProgressError,
	AccountWriteLeaseLostError,
	withAccountWriteLease,
} from '#worker/account/deletion-state.ts'
import { loadResolvedRequestAuth } from './request-auth-cache.ts'

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const mutatingGetPaths = new Set(['/account/mcp-servers/oauth/callback'])
/** Checkout return links the Stripe customer; the portal can change plans. */
const mutatingBillingGetPath = /^\/@[^/]+\/-\/billing\/(?:success|portal)$/

function accountDeletingResponse(status: number) {
	return Response.json(
		{
			error: {
				code: 'account_deleting',
				message:
					'Account deletion is in progress; user-owned writes are disabled.',
			},
		},
		{ status },
	)
}

/** Called only for protocol requests. Native server functions own their write leases. */
export async function withProtocolAccountWriteLease<T>(
	request: Request,
	env: Env,
	next: () => Promise<T>,
): Promise<T | Response> {
	const url = new URL(request.url)
	const mutating =
		unsafeMethods.has(request.method) ||
		mutatingGetPaths.has(url.pathname) ||
		mutatingBillingGetPath.test(url.pathname)
	if (
		!mutating ||
		url.pathname === '/account/delete' ||
		url.pathname === '/logout'
	) {
		return await next()
	}
	const auth = await loadResolvedRequestAuth(request, env)
	if (!auth.user) return await next()
	if (auth.user.accountDeleting) return accountDeletingResponse(409)
	try {
		return await withAccountWriteLease({
			db: env.APP_DB,
			stableUserId: personalOrgIdForPerson(auth.user.mcpUser),
			holder: `web:${request.method} ${url.pathname}`,
			env,
			write: next,
		})
	} catch (error) {
		if (error instanceof AccountDeletionInProgressError) {
			return accountDeletingResponse(409)
		}
		if (error instanceof AccountWriteLeaseLostError) {
			return accountDeletingResponse(503)
		}
		throw error
	}
}

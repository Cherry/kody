import { type Middleware } from 'remix/router'
import {
	isOrgBoundRequest,
	isOrgRequestDenied,
} from '#app/org-request-binding.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { loadResolvedRequestAuth } from './request-auth-cache.ts'

/** Reject inaccessible organization documents and protocol requests before handlers run. */
export function createOrgBindingGuardMiddleware(
	env: Env,
	renderNotFound: (request: Request) => Promise<Response>,
): Middleware {
	return async ({ request, url }, next) => {
		if (!isOrgBoundRequest(url)) return await next()
		const auth = await loadResolvedRequestAuth(request, env)
		if (!auth.user || auth.user.accountSuspended) return await next()
		if (await isOrgRequestDenied(request, env, auth.user.mcpUser.userId)) {
			// Page form posts (MCP consent) read JSON too; only page loads get HTML.
			if (request.method === 'GET' && !url.pathname.endsWith('.json')) {
				return renderNotFound(request)
			}
			return jsonResponse({ ok: false, error: 'Organization not found.' }, 404)
		}
		return next()
	}
}

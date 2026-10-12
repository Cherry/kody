import { type Action } from 'remix/router'
import { loadAccountWebhooksData } from '#app/package-webhooks-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { type routes } from '#universal/routes.ts'

/**
 * JSON API for `/account/webhooks.json`: GET lists every declared webhook
 * with minted state and never the URL. Mutations (mint, rotate, reveal,
 * enable, disable) live on the package-scoped
 * `/profiles/:username/packages/:kodyId/webhooks.json`.
 */
export function createAccountWebhooksApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}
			if (request.method !== 'GET') {
				return jsonResponse(
					{ ok: false, error: 'Method not allowed.' },
					{ status: 405, headers: { Allow: 'GET' } },
				)
			}
			return jsonResponse(
				await loadAccountWebhooksData({
					env,
					requestUrl: request.url,
					user,
				}),
			)
		},
	} satisfies Action<typeof routes.accountWebhooksApi>
}

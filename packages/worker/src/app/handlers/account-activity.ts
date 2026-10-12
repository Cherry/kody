import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { loadAccountActivityData } from '#app/account-activity-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { type routes } from '#universal/routes.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'

export function readPathRunId(params: unknown) {
	if (
		typeof params === 'object' &&
		params !== null &&
		'runId' in params &&
		typeof params.runId === 'string'
	) {
		return params.runId
	}
	return undefined
}

/**
 * JSON API for `/account/activity.json` (GET list/detail + pagination).
 */
export function createAccountActivityApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method !== 'GET') {
				return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const serverTiming: Array<ServerTimingEntry> = []
			return jsonResponse(
				await loadAccountActivityData({
					env,
					request,
					user,
					serverTiming,
				}),
				{ serverTiming },
			)
		},
	} satisfies Action<typeof routes.accountActivityApi>
}

import { type Action } from 'remix/router'
import { jsonResponse } from '#worker/json-response.ts'
import { loadAdminInsightsData } from '#app/admin-insights-data.ts'
import { requireUserWithRole } from '#app/permissions-server.ts'
import { type routes } from '#universal/routes.ts'

export function createAdminInsightsApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			try {
				await requireUserWithRole(request, env, 'admin')
				const payload = await loadAdminInsightsData(env)
				return jsonResponse(payload)
			} catch (error) {
				if (error instanceof Response) return error
				throw error
			}
		},
	} satisfies Action<typeof routes.adminInsightsApi>
}

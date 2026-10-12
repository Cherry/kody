import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { loadAdminRolesData } from '#app/admin-roles-data.ts'
import { requireUserWithPermission } from '#app/permissions-server.ts'
import { type routes } from '#universal/routes.ts'

export function createAdminRolesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			try {
				await requireUserWithPermission(request, env, 'read:role:any')
				const payload = await loadAdminRolesData(env)
				return jsonResponse(payload)
			} catch (error) {
				if (error instanceof Response) {
					return error
				}
				throw error
			}
		},
	} satisfies Action<typeof routes.adminRolesApi>
}

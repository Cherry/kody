import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import {
	loadClientsPayload,
	mutateAccountMcpOauthClients,
} from './account-mcp-oauth-clients.ts'
export * from './account-mcp-oauth-clients.ts'
export function testAccountMcpOauthClientsApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				return operationResult(
					await loadClientsPayload(env.APP_DB, user.userId),
				)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			const result = await mutateAccountMcpOauthClients({
				request,
				env,
				user,
				body: body as Record<string, unknown>,
			})
			return operationResult(result.data, result.status)
		},
	}
}

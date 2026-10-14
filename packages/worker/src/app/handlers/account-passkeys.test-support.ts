import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { loadPasskeysPayload, mutatePasskeys } from './account-passkeys.ts'
export function testAccountPasskeysApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				return operationResult(
					await loadPasskeysPayload(env.APP_DB, user.userId),
				)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			const result = await mutatePasskeys({ env, request, user, body })
			return operationResult(
				result,
				result.ok
					? 200
					: 'code' in result && result.code === 'not_found'
						? 404
						: 400,
			)
		},
	}
}

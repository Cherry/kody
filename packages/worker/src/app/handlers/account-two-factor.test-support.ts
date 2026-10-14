import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { loadTwoFactorStatus, mutateTwoFactor } from './account-two-factor.ts'
export function testAccountTwoFactorApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				return operationResult(
					await loadTwoFactorStatus(env.APP_DB, user.userId),
				)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			const result = await mutateTwoFactor({ env, request, user, body })
			return operationResult(result, result.ok ? 200 : 400)
		},
	}
}

import { connectSecretsInput } from '../../../start/connect-input.ts'
import {
	loadAccountSecretsSelection,
	readAccountSecretsSelectedSecretId,
} from '#app/account-secrets-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { mutateAccountSecrets } from './account-secrets.ts'
export * from './account-secrets.ts'

export function testAccountSecretsApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				const payload = await loadAccountSecretsSelection({
					...connectSecretsInput(new URL(request.url).search),
					selectedSecretId: readAccountSecretsSelectedSecretId(request.url),
					env,
					user,
				})
				return operationResult(payload)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			if (!body || typeof body !== 'object') {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}

			const result = await mutateAccountSecrets({
				refresh: {
					...connectSecretsInput(new URL(request.url).search),
					selectedSecretId: readAccountSecretsSelectedSecretId(request.url),
				},
				request,
				env,
				user,
				body: body as Record<string, unknown>,
			})
			return operationResult(result.data, result.status)
		},
	}
}

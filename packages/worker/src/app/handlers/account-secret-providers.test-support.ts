import { loadAccountSecretProvidersData } from '#app/account-secret-providers-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { mutateAccountSecretProviders } from './account-secret-providers.ts'
export * from './account-secret-providers.ts'
export function testAccountSecretProvidersApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}
			if (request.method === 'GET') {
				return operationResult(
					await loadAccountSecretProvidersData({
						env,
						userId: ownerIdFromCaller({
							request: user.request,
							user: user.mcpUser,
						}),
						email: user.email,
						approval: {
							provider:
								new URL(request.url).searchParams.get('provider') ?? undefined,
							ref: new URL(request.url).searchParams.get('ref') ?? undefined,
							packageId:
								new URL(request.url).searchParams.get('package_id') ??
								undefined,
							packageName:
								new URL(request.url).searchParams.get('package') ?? undefined,
						},
					}),
				)
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
			const result = await mutateAccountSecretProviders({
				request,
				env,
				user,
				body: body as Record<string, unknown>,
			})
			return operationResult(result.data, result.status)
		},
	}
}

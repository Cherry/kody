import {
	hasStoredConnectClientSecret,
	loadAccountIntegrationByName,
	loadAccountIntegrationsData,
	loadAccountOauthAppBySlug,
	loadExistingConnectionSummary,
	readConnectOauthLookupOptions,
} from '#app/account-integrations-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadConnectOauthChooser } from '#app/connect-oauth-chooser.ts'
import { operationResult } from '#app/operation-result.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { waitUntil } from 'cloudflare:workers'
import { mutateAccountIntegrations } from './account-integrations.ts'
export * from './account-integrations.ts'
export function testAccountIntegrationsApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				const searchParams = new URL(request.url).searchParams
				if (searchParams.get('connectChooser') === '1') {
					return operationResult({
						ok: true,
						chooser: await loadConnectOauthChooser({
							env,
							userId: ownerIdFromCaller({
								request: user.request,
								user: user.mcpUser,
							}),
						}),
					})
				}
				const name = searchParams.get('name')?.trim()
				const approvalPackageId = searchParams.get('package_id')?.trim()
				if (name && !approvalPackageId) {
					// `app=<slug>` reuses a saved bring-your-own app under `name`.
					// `platform=` is ignored: built-in connect is retired.
					const integration = await loadAccountIntegrationByName(
						env,
						user,
						name,
						readConnectOauthLookupOptions(searchParams),
					)
					const [existingConnection, hasStoredClientSecret] = await Promise.all(
						[
							loadExistingConnectionSummary(env, user, name),
							hasStoredConnectClientSecret(env, user, name, integration),
						],
					)
					return operationResult({
						ok: true,
						integration,
						builtInAvailable: false,
						existingConnection,
						hasStoredClientSecret,
					})
				}
				const appSlug = searchParams.get('appSlug')?.trim()
				if (appSlug) {
					const app = await loadAccountOauthAppBySlug(env, user, appSlug)
					if (!app) {
						return operationResult(
							{ ok: false, error: 'OAuth app not found.' },
							404,
						)
					}
					return operationResult({ ok: true, app })
				}
				return operationResult(
					await loadAccountIntegrationsData(env, user, {
						waitUntil,
						searchParams: new URL(request.url).searchParams,
					}),
				)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			const result = await mutateAccountIntegrations({
				request,
				env,
				user,
				body: body as Record<string, unknown>,
			})
			return operationResult(result.data, result.status)
		},
	}
}

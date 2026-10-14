import { loadAccountMcpServersData } from '#app/account-mcp-servers-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { waitUntil } from 'cloudflare:workers'
import {
	addAccountMcpServer,
	reconnectAccountMcpServer,
	refreshAccountMcpServer,
	setAccountMcpServerEnabled,
	setAccountMcpServerUsage,
	deleteAccountMcpServer,
	setAccountMcpServerOAuthClient,
	removeAccountMcpServerOAuthClient,
} from './account-mcp-servers.ts'
export * from './account-mcp-servers.ts'
export function testAccountMcpServersApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				return operationResult(
					await loadAccountMcpServersData({
						env,
						user,
						requestUrl: request.url,
						waitUntil,
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

			const values = body as Record<string, unknown>
			const field = (key: string) =>
				typeof values[key] === 'string' ? values[key].trim() : ''
			const input = { request, env, user, id: field('id') }
			let result
			switch (values.action) {
				case 'add':
					result = await addAccountMcpServer({
						...input,
						name: field('name'),
						url: field('url'),
						bearerToken: field('bearerToken') || undefined,
					})
					break
				case 'reconnect':
					result = await reconnectAccountMcpServer(input)
					break
				case 'refresh':
					result = await refreshAccountMcpServer(input)
					break
				case 'delete':
					result = await deleteAccountMcpServer(input)
					break
				case 'set-enabled':
					result = await setAccountMcpServerEnabled({
						...input,
						enabled:
							typeof values.enabled === 'boolean' ? values.enabled : true,
					})
					break
				case 'set-usage': {
					const usageMode = field('usageMode')
					if (usageMode !== 'any' && usageMode !== 'packages')
						return operationResult(
							{ ok: false, error: 'Usage must be any or packages.' },
							400,
						)
					result = await setAccountMcpServerUsage({
						...input,
						usageMode,
						allowedPackageIds: Array.isArray(values.allowedPackageIds)
							? values.allowedPackageIds.filter(
									(value): value is string => typeof value === 'string',
								)
							: [],
					})
					break
				}
				case 'set-oauth-client':
					result = await setAccountMcpServerOAuthClient({
						...input,
						clientId: field('clientId'),
						clientSecret: field('clientSecret'),
					})
					break
				case 'remove-oauth-client':
					result = await removeAccountMcpServerOAuthClient(input)
					break
				default:
					return operationResult({ ok: false, error: 'Invalid action.' }, 400)
			}

			return operationResult(result.data, result.status)
		},
	}
}

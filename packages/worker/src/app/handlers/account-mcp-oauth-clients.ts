import {
	getOAuthClientHelpers,
	listUserMcpOauthClients,
	mintUserMcpOauthClient,
	parseClientLabel,
	parseRedirectUriText,
	revokeUserMcpOauthClient,
	type UserMcpOauthClientListItem,
} from '#app/account-mcp-oauth-clients.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { type AccountMcpOauthClientsLoaderData } from '#universal/loader-data.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import { enum_, object, optional, parseSafe, string } from 'remix/data-schema'

const clientActionSchema = object({
	intent: enum_(['create', 'revoke'] as const),
	id: optional(string()),
	label: optional(string()),
	redirectUris: optional(string()),
})

export async function loadClientsPayload(
	db: D1Database,
	userId: number,
): Promise<AccountMcpOauthClientsLoaderData> {
	const clients: Array<UserMcpOauthClientListItem> =
		await listUserMcpOauthClients(db, userId)
	return {
		ok: true,
		clients,
	}
}

export async function mutateAccountMcpOauthClients({
	request,
	env,
	user,
	body,
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: Record<string, unknown>
}) {
	const parsed = parseSafe(clientActionSchema, body)
	if (!parsed.success) {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}

	const requestIp = getRequestIp(request) ?? undefined
	const intent = parsed.value.intent

	switch (intent) {
		case 'create': {
			if (!user.emailVerified) {
				return operationResult(
					{
						ok: false,
						error: 'Verify your email before creating an MCP OAuth client.',
					},
					403,
				)
			}

			const label = parseClientLabel(parsed.value.label)
			if (!label.ok) {
				return operationResult({ ok: false, error: label.error }, 400)
			}
			const redirectUris = parseRedirectUriText(parsed.value.redirectUris)
			if (!redirectUris.ok) {
				return operationResult({ ok: false, error: redirectUris.error }, 400)
			}

			let helpers: ReturnType<typeof getOAuthClientHelpers>
			try {
				helpers = getOAuthClientHelpers(env)
			} catch {
				return operationResult(
					{ ok: false, error: 'OAuth client registration is unavailable.' },
					503,
				)
			}

			const minted = await mintUserMcpOauthClient({
				db: env.APP_DB,
				helpers,
				userId: user.userId,
				label: label.label,
				redirectUris: redirectUris.uris,
			})
			if (!minted.ok) {
				return operationResult(
					{ ok: false, error: minted.error },
					minted.status,
				)
			}

			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'oauth',
				action: 'mcp_oauth_client_create',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: new URL(request.url).pathname,
				clientId: minted.client.clientId,
			})
			return operationResult({
				...(await loadClientsPayload(env.APP_DB, user.userId)),
				createdClient: minted.client,
			})
		}
		case 'revoke': {
			const id = parsed.value.id?.trim() ?? ''
			if (!id) {
				return operationResult(
					{ ok: false, error: 'OAuth client id is required.' },
					400,
				)
			}

			let helpers: ReturnType<typeof getOAuthClientHelpers>
			try {
				helpers = getOAuthClientHelpers(env)
			} catch {
				return operationResult(
					{ ok: false, error: 'OAuth client registration is unavailable.' },
					503,
				)
			}

			const revoked = await revokeUserMcpOauthClient({
				db: env.APP_DB,
				helpers,
				userId: user.userId,
				id,
			})
			if (!revoked.ok) {
				return operationResult(
					{ ok: false, error: revoked.error },
					revoked.status,
				)
			}

			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'oauth',
				action: 'mcp_oauth_client_revoke',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: new URL(request.url).pathname,
			})
			return operationResult(await loadClientsPayload(env.APP_DB, user.userId))
		}
		default: {
			const _exhaustive: never = intent
			void _exhaustive
			return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
		}
	}
}

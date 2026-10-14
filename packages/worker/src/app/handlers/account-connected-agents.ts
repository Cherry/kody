import { personalOrgIdForPerson } from '#worker/orgs/personal-org-id.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { deleteMcpEventSubscriptionsForOauthClient } from '#mcp/events/subscriptions-repo.ts'
import { type AccountConnectedAgentsLoaderData } from '#universal/loader-data.ts'
import {
	countConnectedAgentEcosystems,
	hasSecondConnectedMcpClient,
} from '#universal/onboarding-agent-ecosystems.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import {
	loadInboundMcpConnectionState,
	revokeConnectedMcpAgent,
} from '#worker/connected-mcp-agents.ts'
import {
	applyConnectionProfileMutation,
	loadConnectionProfilesForAccount,
} from '#worker/connection-profiles/account.ts'
import { maybeEvaluateSecondAgentStandardGift } from '#worker/entitlements/second-agent-standard-gift.ts'
import {
	type OAuthGrantHelpers,
	type OAuthGrantListHelpers,
} from '#worker/oauth-grants.ts'
import { resolveOAuthHelpers } from '#worker/oauth-helpers.ts'
import { buildMcpServerUrl } from '#worker/onboarding-prompts.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import {
	personalOrgId,
	type OwnerId,
	type PersonId,
} from '@kody-internal/shared/owner-person-ids.ts'
import { type RequestContext } from '@kody-internal/shared/request-context.ts'
import { enum_, object, parseSafe, string } from 'remix/data-schema'

type ConnectedAgentsUser = {
	mcpUser: { userId: PersonId; personalOrgId?: OwnerId | null }
	emailVerified: boolean
	request: RequestContext
}

/**
 * Inbound agents are OAuth grants held by the signed-in person. The page org
 * (`request.org.id`) picks which of them to show: the ones approved for that
 * org. Connection profiles and the second-agent gift stay on the signup org.
 */
function connectedAgentsScope(user: ConnectedAgentsUser) {
	// Grants are person-keyed (legacy OwnerId brand of the person id).
	const personId = personalOrgId(user.mcpUser.userId)
	const personalOrgOwnerId = personalOrgIdForPerson(user.mcpUser)
	const orgId = ownerIdFromCaller({
		request: user.request,
		user: user.mcpUser,
	})
	return {
		personId,
		orgId,
		personalOrgOwnerId,
		personalOrg: orgId === personalOrgOwnerId,
	}
}

export async function loadAccountConnectedAgentsData(input: {
	env: Env
	requestUrl: string | URL
	user: ConnectedAgentsUser
}): Promise<AccountConnectedAgentsLoaderData> {
	const { personId, orgId, personalOrg, personalOrgOwnerId } =
		connectedAgentsScope(input.user)
	const helpers = await resolveOAuthHelpers<OAuthGrantListHelpers>(input.env)
	const state = await loadInboundMcpConnectionState(helpers, personId, {
		env: input.env,
		orgId,
	})
	if (
		personalOrg &&
		!state.listingFailed &&
		hasSecondConnectedMcpClient(state.agents)
	) {
		await maybeEvaluateSecondAgentStandardGift({
			db: input.env.APP_DB,
			stableUserId: personalOrgOwnerId,
			ecosystemCount: countConnectedAgentEcosystems(state.agents),
			listingFailed: state.listingFailed,
		})
	}
	return {
		ok: true,
		agents: state.agents,
		mcpServerUrl: input.user.emailVerified
			? buildMcpServerUrl({ env: input.env, requestUrl: input.requestUrl })
			: '',
		...(personalOrg
			? await loadConnectionProfilesForAccount({
					env: input.env,
					requestUrl: input.requestUrl,
					userId: personId,
					emailVerified: input.user.emailVerified,
				})
			: {
					connectionProfilesEnabled: false,
					connectionProfiles: [],
					connectionProfilePackageOptions: [],
				}),
	}
}

const revokeSchema = object({
	intent: enum_(['revoke'] as const),
	clientId: string(),
})

export async function mutateAccountConnectedAgents({
	request,
	env,
	user,
	body,
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: unknown
}) {
	if (
		body &&
		typeof body === 'object' &&
		'intent' in body &&
		(body.intent === 'create' ||
			body.intent === 'update' ||
			body.intent === 'delete')
	) {
		if (!connectedAgentsScope(user).personalOrg) {
			return operationResult(
				{
					ok: false,
					error:
						'Connection profiles are only available in your personal organization.',
				},
				404,
			)
		}
		const mutation = await applyConnectionProfileMutation({
			env,
			requestUrl: request.url,
			userId: personalOrgId(user.mcpUser.userId),
			emailVerified: user.emailVerified,
			body,
		})
		if (!mutation.ok) {
			return operationResult(
				{ ok: false, error: mutation.error },
				mutation.status,
			)
		}
		const payload = await loadAccountConnectedAgentsData({
			env,
			requestUrl: request.url,
			user,
		})
		return operationResult({
			...payload,
			connectionProfiles: mutation.connectionProfiles,
			connectionProfilePackageOptions: mutation.connectionProfilePackageOptions,
		})
	}

	const parsed = parseSafe(revokeSchema, body)
	if (!parsed.success || parsed.value.intent !== 'revoke') {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}

	const helpers = await resolveOAuthHelpers<OAuthGrantHelpers>(env)
	if (!helpers) {
		return operationResult(
			{ ok: false, error: 'Connected agent listing is unavailable.' },
			503,
		)
	}

	const { personId, orgId } = connectedAgentsScope(user)
	const revoked = await revokeConnectedMcpAgent({
		helpers,
		userId: personId,
		clientId: parsed.value.clientId.trim(),
		orgId,
		env,
	})
	if ('error' in revoked) {
		// Retry cleanup when grants are already gone but subscription
		// rows may have survived a prior partial revoke.
		if (!revoked.clientRemains) {
			await deleteMcpEventSubscriptionsForOauthClient({
				db: env.APP_DB,
				oauthClientId: parsed.value.clientId.trim(),
				userId: personId,
			})
		}
		return operationResult(
			{ ok: false, error: 'Connected agent not found.' },
			404,
		)
	}
	if (!revoked.clientRemains) {
		await deleteMcpEventSubscriptionsForOauthClient({
			db: env.APP_DB,
			oauthClientId: parsed.value.clientId.trim(),
			userId: personId,
		})
	}

	void logAuditEvent({
		db: auditDatabaseFromEnv(env),
		category: 'oauth',
		action: 'mcp_inbound_grant_revoke',
		result: 'success',
		email: user.email,
		ip: getRequestIp(request) ?? undefined,
		path: new URL(request.url).pathname,
		clientId: parsed.value.clientId.trim(),
	})
	return operationResult(
		await loadAccountConnectedAgentsData({
			env,
			requestUrl: request.url,
			user,
		}),
	)
}

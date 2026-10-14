import { operationResult } from '../operation-result.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { getRequestIp } from '#worker/audit-log.ts'
import {
	checkRateLimit,
	orgInviteJoinRateLimitConfig,
	releaseRateLimit,
} from '#app/rate-limit.ts'
import { buildOrgAvatarUrl } from '#worker/orgs/org-avatar.ts'
import {
	getInviteLinkByTokenHash,
	hashInviteLinkToken,
	inviteLinkBlockMessage,
	inviteLinkIsRedeemable,
	redeemOrgInviteLink,
	type InviteLinkRedeemBlockReason,
} from '#worker/orgs/invite-links.ts'
import { getLiveOrgMembership } from '#worker/orgs/org-members-list.ts'
import { orgAuditWriterFromRequest } from '#worker/orgs/org-audit.ts'
import { getOrgById, isOrgActive } from '#worker/orgs/repo.ts'
import { isPersonalOrg } from '#worker/orgs/is-personal-org.ts'
import { type OrgInviteJoinLoaderData } from '#universal/loader-data.ts'
import { orgRoleLabel } from '#universal/org-pages.ts'

function joinRateLimitKey(request: Request, token: string) {
	const ip = getRequestIp(request) ?? 'unknown'
	const tokenPrefix = token.slice(0, 8) || 'missing'
	return `org-invite-join:${ip}:${tokenPrefix}`
}

export async function loadJoinPageData(input: {
	env: Env
	request: Request
	token: string
}): Promise<OrgInviteJoinLoaderData> {
	const token = input.token.trim()
	if (!token) {
		return {
			ok: false,
			error: 'Invite link token is required.',
			reason: 'missing',
		}
	}
	const tokenHash = await hashInviteLinkToken(token)
	const link = await getInviteLinkByTokenHash(input.env.APP_DB, tokenHash)
	if (!link) {
		return {
			ok: false,
			error: inviteLinkBlockMessage('invalid'),
			reason: 'invalid',
		}
	}
	const block = inviteLinkIsRedeemable(link)
	if (block) {
		return {
			ok: false,
			error: inviteLinkBlockMessage(block),
			reason: block,
		}
	}
	if (await isPersonalOrg(input.env.APP_DB, link.orgId)) {
		return {
			ok: false,
			error: inviteLinkBlockMessage('personal_org'),
			reason: 'personal_org',
		}
	}
	if (!(await isOrgActive(input.env.APP_DB, link.orgId))) {
		return {
			ok: false,
			error: inviteLinkBlockMessage('org_inactive'),
			reason: 'org_inactive',
		}
	}
	const org = await getOrgById(input.env.APP_DB, link.orgId)
	if (!org) {
		return {
			ok: false,
			error: inviteLinkBlockMessage('invalid'),
			reason: 'invalid',
		}
	}
	const user = await readAuthenticatedAppUser(input.request, input.env)
	const alreadyMember = user
		? Boolean(
				await getLiveOrgMembership(
					input.env.APP_DB,
					link.orgId,
					user.mcpUser.userId,
				),
			)
		: false
	return {
		ok: true,
		token,
		org: {
			slug: org.slug,
			displayName: org.display_name,
			avatarUrl: buildOrgAvatarUrl({
				slug: org.slug,
				avatarKey: org.avatar_key,
			}),
		},
		role: link.role,
		roleLabel: orgRoleLabel(link.role),
		alreadyMember,
		authenticated: Boolean(user),
	}
}

export async function joinWebsiteOrganization({
	env,
	request,
	user,
	token,
}: {
	env: Env
	request: Request
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	token: string
}) {
	const rateKey = joinRateLimitKey(request, token)
	const limited = await checkRateLimit(
		env.APP_DB,
		rateKey,
		orgInviteJoinRateLimitConfig,
	)
	if (!limited.allowed) {
		return operationResult(
			{
				ok: false,
				error: 'Too many join attempts. Try again shortly.',
			},
			429,
		)
	}
	const tokenHash = await hashInviteLinkToken(token.trim())
	const link = await getInviteLinkByTokenHash(env.APP_DB, tokenHash)
	if (!link) {
		return operationResult(
			{
				ok: false,
				error: inviteLinkBlockMessage('invalid'),
				reason: 'invalid' satisfies InviteLinkRedeemBlockReason,
			},
			400,
		)
	}
	const result = await redeemOrgInviteLink({
		db: env.APP_DB,
		env,
		link,
		user: {
			userId: user.mcpUser.userId,
			email: user.email,
			emailVerified: user.emailVerified,
		},
		audit: orgAuditWriterFromRequest(env, user.request),
	})
	if (!result.ok) {
		if (result.reason === 'domain' || result.reason === 'unverified_email') {
			await releaseRateLimit(env.APP_DB, rateKey)
		}
		return operationResult(
			{
				ok: false,
				error: result.error,
				reason: result.reason,
			},
			400,
		)
	}
	const org = await getOrgById(env.APP_DB, result.orgId)
	const slug = org?.slug
	return operationResult({
		ok: true,
		alreadyMember: result.alreadyMember,
		role: result.role,
		orgSlug: slug ?? null,
		redirectTo: slug ? `/@${slug}` : '/',
	})
}

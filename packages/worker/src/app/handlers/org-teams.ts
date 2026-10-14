import { isSecureRequest } from '#app/auth-session.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import {
	orgHasPermission,
	resolveOrgManagementAccess,
	type ManagedOrg,
} from '#app/org-management-access.ts'
import {
	type OrgMemberView,
	type OrgTeamMemberView,
	type OrgTeamView,
	type OrgTeamsLoaderData,
} from '#universal/loader-data.ts'
import { serializeLastUsedOrgCookie } from '#universal/org-last-used-cookie.ts'
import { orgRoleLabel } from '#universal/org-pages.ts'
import { buildUserAvatarUrl } from '#worker/community/public-urls.ts'
import {
	getUsernameFormatValidationError,
	normalizeUsername,
} from '#worker/identity/username.ts'
import {
	addTeamMember,
	createTeam,
	removeTeamMember,
} from '#worker/orgs/access-writes.ts'
import { orgAuditWriterFromRequest } from '#worker/orgs/org-audit.ts'
import { listOrgMembers } from '#worker/orgs/org-members-list.ts'
import { listTeamsWithMembers } from '#worker/orgs/org-teams-list.ts'

export function withLastUsedOrg(
	request: Request,
	slug: string,
	response: Response,
) {
	const headers = new Headers(response.headers)
	headers.append(
		'Set-Cookie',
		serializeLastUsedOrgCookie({
			slug,
			secure: isSecureRequest(request),
		}),
	)
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

function toTeamMemberView(member: {
	userId: string
	username: string | null
	displayName: string | null
	avatarKey: string | null
}): OrgTeamMemberView {
	return {
		userId: member.userId,
		username: member.username,
		displayName: member.displayName,
		avatarUrl: member.username
			? buildUserAvatarUrl({
					username: member.username,
					avatarKey: member.avatarKey,
				})
			: null,
	}
}

function toOrgMemberView(member: {
	userId: string
	username: string | null
	displayName: string | null
	avatarKey: string | null
	role: 'owner' | 'member' | 'billing'
}): OrgMemberView {
	return {
		userId: member.userId,
		username: member.username,
		displayName: member.displayName,
		avatarUrl: member.username
			? buildUserAvatarUrl({
					username: member.username,
					avatarKey: member.avatarKey,
				})
			: null,
		role: member.role,
		roleLabel: orgRoleLabel(member.role),
	}
}

export async function loadOrgTeamsData(input: {
	env: Env
	user: Parameters<typeof orgHasPermission>[1]
	org: ManagedOrg
}): Promise<OrgTeamsLoaderData> {
	const canManage =
		!input.org.personal &&
		(await orgHasPermission(input.env, input.user, 'team:write'))
	const canRemoveMembers =
		!input.org.personal &&
		(await orgHasPermission(input.env, input.user, 'team:delete'))
	const [teams, orgMembers] = await Promise.all([
		listTeamsWithMembers(input.env.APP_DB, input.org.id),
		canManage
			? listOrgMembers(input.env.APP_DB, input.org.id)
			: Promise.resolve([]),
	])
	return {
		ok: true,
		org: input.org,
		teams: teams.map((team): OrgTeamView => ({
			id: team.id,
			slug: team.slug,
			name: team.name,
			description: team.description,
			memberCount: team.memberCount,
			members: team.members.map(toTeamMemberView),
		})),
		orgMembers: orgMembers.map(toOrgMemberView),
		canManage,
		canRemoveMembers,
	}
}

function personalOrgTeamWriteResponse() {
	return operationResult(
		{
			ok: false,
			error:
				'Teams belong to team organizations. Create a team organization to group people.',
		},
		400,
	)
}

export async function createOrganizationTeam({
	request,
	env,
	user,
	orgSlug,
	...fields
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	slug?: unknown
	name?: unknown
	description?: unknown
	orgSlug?: string
}) {
	const access = await resolveOrgManagementAccess({
		request,
		orgSlug,
		env,
		user,
		permission: 'team:write',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) return personalOrgTeamWriteResponse()

	const slugRaw = typeof fields.slug === 'string' ? fields.slug : ''
	const nameRaw = typeof fields.name === 'string' ? fields.name : ''
	const description =
		typeof fields.description === 'string' ? fields.description : undefined
	const slug = normalizeUsername(slugRaw)
	const formatError = getUsernameFormatValidationError(slug)
	if (formatError) {
		return operationResult({ ok: false, error: formatError }, 400)
	}
	const name = nameRaw.trim() || slug
	if (!name) {
		return operationResult(
			{ ok: false, error: 'A team name is required.' },
			400,
		)
	}
	try {
		await createTeam({
			db: env.APP_DB,
			orgId: access.org.id,
			slug,
			name,
			description,
			createdByUserId: user.mcpUser.userId,
			audit: orgAuditWriterFromRequest(env, user.request),
		})
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unable to create that team.'
		const conflict =
			/UNIQUE|unique|already exists/i.test(message) ||
			message.includes('constraint')
		return operationResult(
			{
				ok: false,
				error: conflict ? 'A team with that handle already exists.' : message,
			},
			conflict ? 409 : 400,
		)
	}
	return operationResult(await loadOrgTeamsData({ env, user, org: access.org }))
}
export async function addOrganizationTeamMember({
	request,
	env,
	user,
	orgSlug,
	...fields
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	teamId?: unknown
	userId?: unknown
	orgSlug?: string
}) {
	const access = await resolveOrgManagementAccess({
		request,
		orgSlug,
		env,
		user,
		permission: 'team:write',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) return personalOrgTeamWriteResponse()

	const teamId = typeof fields.teamId === 'string' ? fields.teamId.trim() : ''
	const userId = typeof fields.userId === 'string' ? fields.userId.trim() : ''
	if (!teamId || !userId) {
		return operationResult(
			{ ok: false, error: 'A team and member are required.' },
			400,
		)
	}
	try {
		await addTeamMember({
			db: env.APP_DB,
			orgId: access.org.id,
			teamId,
			userId,
			addedByUserId: user.mcpUser.userId,
			audit: orgAuditWriterFromRequest(env, user.request),
		})
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: 'Unable to add that person to the team.'
		return operationResult({ ok: false, error: message }, 400)
	}
	return operationResult(await loadOrgTeamsData({ env, user, org: access.org }))
}
export async function removeOrganizationTeamMember({
	request,
	env,
	user,
	orgSlug,
	...fields
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	teamId?: unknown
	userId?: unknown
	orgSlug?: string
}) {
	const access = await resolveOrgManagementAccess({
		request,
		orgSlug,
		env,
		user,
		permission: 'team:delete',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) return personalOrgTeamWriteResponse()

	const teamId = typeof fields.teamId === 'string' ? fields.teamId.trim() : ''
	const userId = typeof fields.userId === 'string' ? fields.userId.trim() : ''
	if (!teamId || !userId) {
		return operationResult(
			{ ok: false, error: 'A team and member are required.' },
			400,
		)
	}
	try {
		await removeTeamMember({
			db: env.APP_DB,
			orgId: access.org.id,
			teamId,
			userId,
			audit: orgAuditWriterFromRequest(env, user.request),
		})
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: 'Unable to remove that person from the team.'
		return operationResult({ ok: false, error: message }, 400)
	}
	return operationResult(await loadOrgTeamsData({ env, user, org: access.org }))
}

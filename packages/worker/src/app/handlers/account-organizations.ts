import { loadAccountOrganizationSnapshot } from '#app/account-organizations-data.ts'
import { loadAccountProfileData } from '#app/account-profile-data.ts'
import { type AuthenticatedAppUser } from '#app/authenticated-user.ts'
import { type AccountOrganizationsLoaderData } from '#universal/loader-data.ts'
import {
	AuthorizationError,
	authorize,
} from '#worker/authorization/authorize.ts'
import { createOrganization } from '#worker/orgs/create-organization.ts'
import { orgAuditWriterFromRequest } from '#worker/orgs/org-audit.ts'

export async function loadAccountOrganizationsData(
	env: Env,
	user: AuthenticatedAppUser,
	request: Request,
): Promise<AccountOrganizationsLoaderData> {
	const [snapshot, profile] = await Promise.all([
		loadAccountOrganizationSnapshot(env, user, request),
		loadAccountProfileData(user, env),
	])
	return {
		ok: true,
		username: profile.username,
		viewer: { displayName: profile.displayName, avatarUrl: profile.avatarUrl },
		organizations: snapshot.organizations,
		lastUsedOrganization: snapshot.lastUsedOrganization,
		invites: snapshot.invites,
	}
}

export async function createWebsiteOrganization({
	env,
	user,
	displayName,
	slug,
}: {
	env: Env
	user: AuthenticatedAppUser
	displayName: string
	slug: string
}) {
	try {
		await authorize({ env, request: user.request }, 'org:write')
	} catch (error) {
		if (error instanceof AuthorizationError)
			throw new Error('You do not have permission to create an organization.')
		throw error
	}
	const result = await createOrganization(env.APP_DB, env, {
		personId: user.mcpUser.userId,
		audit: orgAuditWriterFromRequest(env, user.request),
		displayName,
		slug,
	})
	if (!result.ok) throw new Error(result.error)
	return { slug: result.slug }
}

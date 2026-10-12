import { type Action } from 'remix/router'
import { isSecureRequest } from '#app/auth-session.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import {
	orgHasPermission,
	resolveOrgManagementAccess,
	type ManagedOrg,
} from '#app/org-management-access.ts'
import { buildUserAvatarUrl } from '#worker/community/public-urls.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { listOutsideCollaborators } from '#worker/orgs/org-collaborators-list.ts'
import { listOrgGrantsForView } from '#worker/orgs/org-grants-view.ts'
import {
	type OrgCollaboratorView,
	type OrgCollaboratorsLoaderData,
	type OrgGrantView,
} from '#universal/loader-data.ts'
import { serializeLastUsedOrgCookie } from '#universal/org-last-used-cookie.ts'
import { type routes } from '#universal/routes.ts'

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

export async function loadOrgCollaboratorsData(input: {
	env: Env
	user: Parameters<typeof orgHasPermission>[1]
	org: ManagedOrg
}): Promise<OrgCollaboratorsLoaderData> {
	const canManage =
		!input.org.personal &&
		(await orgHasPermission(input.env, input.user, 'member:write'))
	const [people, grants] = await Promise.all([
		listOutsideCollaborators(input.env.APP_DB, input.org.id),
		listOrgGrantsForView(input.env.APP_DB, input.org.id),
	])
	const grantsById = new Map(grants.map((grant) => [grant.id, grant]))
	return {
		ok: true,
		org: input.org,
		collaborators: people.map((person): OrgCollaboratorView => {
			const personGrants: Array<OrgGrantView> = []
			for (const grant of person.grants) {
				const view = grantsById.get(grant.id)
				if (view) personGrants.push(view)
			}
			return {
				userId: person.userId,
				username: person.username,
				displayName: person.displayName,
				avatarUrl: person.username
					? buildUserAvatarUrl({
							username: person.username,
							avatarKey: person.avatarKey,
						})
					: null,
				grants: personGrants,
			}
		}),
		canManage,
	}
}

export function createOrgCollaboratorsApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}
			const access = await resolveOrgManagementAccess({
				request,
				env,
				user,
				permission: 'member:read',
			})
			if (!access.ok) {
				return jsonResponse({ ok: false, error: access.error }, access.status)
			}
			return jsonResponse(
				await loadOrgCollaboratorsData({ env, user, org: access.org }),
			)
		},
	} satisfies Action<typeof routes.orgCollaboratorsApi>
}

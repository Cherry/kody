import { type Action } from 'remix/router'
import {
	personalOrgId,
	type PersonId,
} from '@kody-internal/shared/owner-person-ids.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadOrgRepositoriesData } from '#app/org-repositories-data.ts'
import { orgSectionDenial } from '#app/org-request-binding.ts'
import { createProfileApiHandler } from '#app/handlers/profile.tsx'
import { jsonResponse } from '#worker/json-response.ts'
import { loadOrgBindingForSlug, type OrgBinding } from '#worker/orgs/repo.ts'
import { type OrgOwnedAccountSection } from '#universal/org-pages.ts'
import { type routes } from '#universal/routes.ts'

export function sectionParams(
	section: OrgOwnedAccountSection,
	rest: string | undefined,
) {
	const parts = (rest ?? '').split('/').filter(Boolean)
	const first = parts[0]
	switch (section) {
		case 'activity':
			return first ? { runId: first } : {}
		case 'jobs':
			return first ? { jobId: first } : {}
		case 'workflows':
			return first ? { workflowId: first } : {}
		case 'memories':
			return first ? { memoryId: first } : {}
		case 'email':
			return first ? { messageId: first } : {}
		case 'values':
			return first && first !== 'new' ? { valueId: first } : {}
		case 'connections':
			return first === 'new' && parts[1] ? { agent: parts[1] } : {}
		case 'integrations':
			if (first === 'apps' && parts[1]) return { appSlug: parts[1] }
			if (first && first !== 'approve' && first !== 'apps') {
				return { integrationName: first }
			}
			return {}
		case 'mcp-servers':
			if (first && first !== 'new' && first !== 'logos' && first !== 'oauth') {
				return { serverId: first }
			}
			return {}
		case 'repositories':
		case 'secret-providers':
		case 'secrets':
		case 'waiting':
		case 'webhooks':
			return {}
		default: {
			const exhaustive: never = section
			return exhaustive
		}
	}
}

export function isTeamOrg(binding: OrgBinding, personId: PersonId) {
	return binding.org.id !== personalOrgId(personId)
}

/**
 * JSON for the workspace Repositories page, behind the same gate as
 * `/@slug/-/repositories`. A team org lists the packages it owns that the
 * viewer can see. The signup org lists the person's own inventory, looked up
 * by their current username because the personal-org slug does not follow a
 * username change.
 */
export function createOrgRepositoriesApiHandler(env: Env) {
	const profileApi = createProfileApiHandler(env)
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
			}
			const binding = await loadOrgBindingForSlug(
				env.APP_DB,
				user.mcpUser.userId,
				params.orgSlug,
			)
			const denial = orgSectionDenial(binding ?? 'denied', 'repositories')
			if (denial || !binding) {
				return jsonResponse(
					{ ok: false, error: denial ?? 'Organization unavailable' },
					404,
				)
			}
			if (isTeamOrg(binding, user.mcpUser.userId)) {
				return jsonResponse(
					await loadOrgRepositoriesData({ env, request, user, binding }),
				)
			}
			return profileApi.handler({
				request,
				params: { username: user.username },
				url: new URL(request.url),
			} as never)
		},
	} satisfies Action<typeof routes.orgRepositoriesApi>
}

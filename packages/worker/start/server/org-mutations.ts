import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const orgPeopleActionSchema = z.enum([
	'memberRole',
	'memberRemove',
	'memberInvite',
	'inviteLinkCreate',
	'inviteLinkRevoke',
	'teamCreate',
	'teamMemberAdd',
	'teamMemberRemove',
	'grantRevoke',
])
export type OrgPeopleAction = z.infer<typeof orgPeopleActionSchema>
export const updateOrgPeople = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/),
			action: orgPeopleActionSchema,
			body: z.record(z.string(), z.unknown()),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			members,
			teams,
			grants,
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/org-members.ts'),
			import('../../src/app/handlers/org-teams.ts'),
			import('../../src/app/handlers/org-grants.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) => {
				const input = { ...context, orgSlug: data.orgSlug, body: data.body }
				switch (data.action) {
					case 'memberRole':
						return requireOperationResult(
							await members.mutateOrgMembersRole(input),
						)
					case 'memberRemove':
						return requireOperationResult(
							await members.mutateOrgMembersRemove(input),
						)
					case 'memberInvite':
						return requireOperationResult(
							await members.mutateOrgMembersInvite(input),
						)
					case 'inviteLinkCreate':
						return requireOperationResult(
							await members.mutateOrgMembersInviteLinks(input),
						)
					case 'inviteLinkRevoke':
						return requireOperationResult(
							await members.mutateOrgMembersInviteLinksRevoke(input),
						)
					case 'teamCreate':
						return requireOperationResult(
							await teams.mutateOrgTeamsCreate(input),
						)
					case 'teamMemberAdd':
						return requireOperationResult(
							await teams.mutateOrgTeamsMemberAdd(input),
						)
					case 'teamMemberRemove':
						return requireOperationResult(
							await teams.mutateOrgTeamsMemberRemove(input),
						)
					case 'grantRevoke':
						return requireOperationResult(
							await grants.mutateOrgGrantsRevoke(input),
						)
				}
			},
		)
	})

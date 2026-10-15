import {
	revokeOrganizationMemberInvite,
	setOrganizationMemberRole,
	removeOrganizationMember,
	inviteOrganizationMember,
	createOrganizationInviteLink,
	revokeOrganizationInviteLink,
	createOrganizationTeam,
	addOrganizationTeamMember,
	removeOrganizationTeamMember,
	revokeOrganizationGrant,
} from '#start/server/org-mutations'
import {
	revokeOrganizationMemberInviteSchema,
	setOrganizationMemberRoleSchema,
	removeOrganizationMemberSchema,
	inviteOrganizationMemberSchema,
	createOrganizationInviteLinkSchema,
	revokeOrganizationInviteLinkSchema,
	createOrganizationTeamSchema,
	addOrganizationTeamMemberSchema,
	removeOrganizationTeamMemberSchema,
	revokeOrganizationGrantSchema,
} from '#universal/org-people-mutations.ts'
export type OrgPeopleAction =
	| 'memberInviteRevoke'
	| 'memberRole'
	| 'memberRemove'
	| 'memberInvite'
	| 'inviteLinkCreate'
	| 'inviteLinkRevoke'
	| 'teamCreate'
	| 'teamMemberAdd'
	| 'teamMemberRemove'
	| 'grantRevoke'
import {
	mutationOptions,
	useMutation,
	useQueryClient,
	type QueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { z } from 'zod'

const resultSchema = z.object({
	ok: z.boolean(),
	error: z.string().optional(),
	invite: z.object({ prompt: z.string() }).optional(),
	inviteLink: z.object({ url: z.string() }).optional(),
})

/** The mutation owns the submitted actor and organization even after navigation. */
export function useOrgPeopleMutation(queryKey: QueryKey) {
	const client = useQueryClient()
	return useMutation(orgPeopleMutationOptions(client, queryKey))
}

export function orgPeopleMutationOptions(
	client: QueryClient,
	queryKey: QueryKey,
) {
	return mutationOptions({
		onMutate: () => ({ queryKey }),
		mutationFn: async ({
			action,
			body,
		}: {
			action: OrgPeopleAction
			body: Record<string, unknown>
		}) => {
			const input = queryKey[3]
			if (
				!input ||
				typeof input !== 'object' ||
				!('slug' in input) ||
				typeof input.slug !== 'string'
			)
				throw new Error('Organization unavailable.')
			switch (action) {
				case 'memberInviteRevoke':
					return resultSchema.parse(
						await revokeOrganizationMemberInvite({
							data: {
								orgSlug: input.slug,
								...revokeOrganizationMemberInviteSchema.parse(body),
							},
						}),
					)
				case 'memberRole':
					return resultSchema.parse(
						await setOrganizationMemberRole({
							data: {
								orgSlug: input.slug,
								...setOrganizationMemberRoleSchema.parse(body),
							},
						}),
					)
				case 'memberRemove':
					return resultSchema.parse(
						await removeOrganizationMember({
							data: {
								orgSlug: input.slug,
								...removeOrganizationMemberSchema.parse(body),
							},
						}),
					)
				case 'memberInvite':
					return resultSchema.parse(
						await inviteOrganizationMember({
							data: {
								orgSlug: input.slug,
								...inviteOrganizationMemberSchema.parse(body),
							},
						}),
					)
				case 'inviteLinkCreate':
					return resultSchema.parse(
						await createOrganizationInviteLink({
							data: {
								orgSlug: input.slug,
								...createOrganizationInviteLinkSchema.parse(body),
							},
						}),
					)
				case 'inviteLinkRevoke':
					return resultSchema.parse(
						await revokeOrganizationInviteLink({
							data: {
								orgSlug: input.slug,
								...revokeOrganizationInviteLinkSchema.parse(body),
							},
						}),
					)
				case 'teamCreate':
					return resultSchema.parse(
						await createOrganizationTeam({
							data: {
								orgSlug: input.slug,
								...createOrganizationTeamSchema.parse(body),
							},
						}),
					)
				case 'teamMemberAdd':
					return resultSchema.parse(
						await addOrganizationTeamMember({
							data: {
								orgSlug: input.slug,
								...addOrganizationTeamMemberSchema.parse(body),
							},
						}),
					)
				case 'teamMemberRemove':
					return resultSchema.parse(
						await removeOrganizationTeamMember({
							data: {
								orgSlug: input.slug,
								...removeOrganizationTeamMemberSchema.parse(body),
							},
						}),
					)
				case 'grantRevoke':
					return resultSchema.parse(
						await revokeOrganizationGrant({
							data: {
								orgSlug: input.slug,
								...revokeOrganizationGrantSchema.parse(body),
							},
						}),
					)
			}
		},
		onSettled: async (_result, _error, _variables, submission) => {
			if (!submission) return
			const queryKey = submission.queryKey
			const submittedInput = queryKey[3]
			if (
				!submittedInput ||
				typeof submittedInput !== 'object' ||
				!('slug' in submittedInput)
			)
				return
			const slug = submittedInput.slug
			const filters = {
				predicate: (query: { queryKey: QueryKey }) => {
					const [kind, actor, resource, input] = query.queryKey
					if (actor !== queryKey[1]) return false
					// Membership controls the account menu and organization chooser too.
					if (kind === 'shell') return true
					if (kind !== 'page') return false
					if (resource === 'loadOrganizations') return true

					return (
						input !== null &&
						typeof input === 'object' &&
						(('orgSlug' in input && input.orgSlug === slug) ||
							('slug' in input && input.slug === slug) ||
							('username' in input && input.username === slug))
					)
				},
			}
			// A lost response can follow an accepted membership or permission write.
			// Cancel earlier reads so they cannot restore pre-write data afterward.
			await client.cancelQueries(filters)
			await client.invalidateQueries(filters)
		},
	})
}

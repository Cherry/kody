import {
	useMutation,
	useQueryClient,
	mutationOptions,
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
			href,
			body,
		}: {
			href: string
			body: Record<string, unknown>
		}) => {
			const response = await fetch(href, {
				method: 'POST',
				credentials: 'include',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			})
			const result = resultSchema.safeParse(
				await response.json().catch(() => null),
			)
			if (!response.ok || !result.success || !result.data.ok)
				throw new Error(
					response.status === 401
						? 'Sign in again to continue.'
						: result.success
							? (result.data.error ?? 'Unable to save changes.')
							: 'Unable to save changes.',
				)
			return result.data
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
					if (typeof input === 'string') {
						const pathname = new URL(input, 'https://kody.local').pathname
						return pathname === `/@${slug}` || pathname.startsWith(`/@${slug}/`)
					}
					return (
						input !== null &&
						typeof input === 'object' &&
						(('slug' in input && input.slug === slug) ||
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

import {
	useMutation,
	useQueryClient,
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
	return useMutation({
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
		onSuccess: async (_result, _variables, submission) => {
			const queryKey = submission.queryKey
			await client.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === queryKey[0] &&
					query.queryKey[1] === queryKey[1] &&
					typeof query.queryKey[3] === 'object' &&
					query.queryKey[3] !== null &&
					'slug' in query.queryKey[3] &&
					typeof queryKey[3] === 'object' &&
					queryKey[3] !== null &&
					'slug' in queryKey[3] &&
					query.queryKey[3].slug === queryKey[3].slug,
			})
		},
	})
}

import { useMatchedPageScope } from './use-matched-page-scope.ts'
import { useSubmitterScope } from './use-submitter-scope.ts'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { acceptedPageMutationOptions } from './accepted-page-mutation.ts'
import { type PageResource } from './page-resources.ts'
import { type PageMutationDependencies } from './page-invalidation-cache.ts'

export function usePageResponseMutation<
	TResponse extends { ok?: boolean; error?: string },
	TInput extends Record<string, unknown> = Record<string, unknown>,
>(
	queryKey: QueryKey,
	resource: PageResource,
	send: (body: TInput, href: string) => Promise<TResponse>,
	options: {
		dependencyScope?: 'actor' | 'org'
		dependencies?: PageMutationDependencies
		refreshShell?: boolean
		merge?: (
			page: { payload: TResponse; [key: string]: unknown },
			accepted: TResponse,
		) => { payload: TResponse; [key: string]: unknown }
	} = {},
) {
	const client = useQueryClient()
	const { actorKey, pageLocation } = useMatchedPageScope()
	const href = pageLocation.href
	const captureSubmitter = useSubmitterScope()

	const mutation = useMutation(
		acceptedPageMutationOptions<TInput, TResponse>(client, {
			resource,
			...options,
			send: async ({ body, href }) => {
				const payload = await send(body, href)
				if (!payload.ok)
					throw new Error(payload.error || 'Unable to save changes.')
				return payload
			},
		}),
	)
	return {
		...mutation,
		submit: (body: TInput) => {
			const isCurrentSubmitter = captureSubmitter()
			return mutation
				.mutateAsync({ body, actorKey, href, queryKey })
				.catch((error) => {
					if (
						error instanceof Error &&
						error.message === 'Please sign in again.' &&
						isCurrentSubmitter()
					)
						window.location.assign(
							`/login?redirectTo=${encodeURIComponent(href)}`,
						)
					throw error
				})
		},
	}
}

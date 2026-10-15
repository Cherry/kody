import { type QueryClient } from '@tanstack/react-query'
import { type AccountValuesLoaderData } from '#universal/loader-data.ts'
import { scopedPageResource, type PageOrgScope } from '../page-query-scope.ts'
import { invalidatePageResources } from '../page-invalidation-cache.ts'

export type ValuesQueryData = { payload: AccountValuesLoaderData }

export function valuesMutationOptions<TResult>(
	client: QueryClient,
	actorKey: string | null,
	send: (action: { name: string; orgSlug: string | null }) => Promise<TResult>,
	scope: PageOrgScope = { orgSlug: null },
) {
	return {
		mutationKey: ['values', actorKey, scope.orgSlug] as const,
		mutationFn: send,
		retry: false,
		onMutate: ({ orgSlug }: { name: string; orgSlug: string | null }) => ({
			actorKey,
			orgSlug,
		}),
		onSettled: async (
			_data: unknown,
			_error: Error | null,
			_input: unknown,
			submitted:
				| { actorKey: string | null; orgSlug: string | null }
				| undefined,
		) => {
			if (!submitted) return
			const scope = { orgSlug: submitted.orgSlug }
			const unfinished = client
				.getQueryCache()
				.findAll(
					scopedPageResource(submitted.actorKey, 'loadValuesPage', scope),
				)
				.filter(
					(query) =>
						query.state.data === undefined &&
						query.state.fetchStatus === 'fetching',
				)
			// A navigation owns this first-read promise. Let it finish, then confirm
			// the write with a new read, even if that navigation has not mounted yet.
			await Promise.allSettled(unfinished.map((query) => query.promise))
			await invalidatePageResources(
				client,
				submitted.actorKey,
				['loadValuesPage', 'loadUsagePage'],
				'active',
				scope,
			)
			await client.refetchQueries(
				{
					predicate: (query) => unfinished.includes(query) && !query.isActive(),
				},
				{ cancelRefetch: false },
			)
		},
	}
}

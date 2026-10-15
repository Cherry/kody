import { type QueryClient } from '@tanstack/react-query'
import { type AccountValuesLoaderData } from '#universal/loader-data.ts'
import { type PageOrgScope } from '../page-query-scope.ts'
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
		onSettled: (
			_data: unknown,
			_error: Error | null,
			_input: unknown,
			submitted:
				| { actorKey: string | null; orgSlug: string | null }
				| undefined,
		) =>
			submitted
				? invalidatePageResources(
						client,
						submitted.actorKey,
						['loadValuesPage', 'loadUsagePage'],
						'active',
						{ orgSlug: submitted.orgSlug },
					)
				: undefined,
	}
}

import { type QueryClient } from '@tanstack/react-query'
import { orgPageFilters } from './org-page-cache.ts'
import { invalidatePageResources } from './page-invalidation-cache.ts'

export function connectionProfileMutationOptions(
	client: QueryClient,
	actorKey: string | null,
	orgSlug: string | null,
) {
	return {
		mutationKey: ['connectionProfiles', actorKey, orgSlug],
		gcTime: 0,
		onMutate: async () => {
			const scope = { actorKey, orgSlug }
			await client.cancelQueries(
				orgPageFilters(actorKey, 'loadConnectionsPage', { orgSlug }),
			)
			return scope
		},
		onSettled: (
			_data: unknown,
			_error: unknown,
			_input: unknown,
			scope: { actorKey: string | null; orgSlug: string | null } | undefined,
		) => {
			if (!scope) return
			// Preserve uncached navigation reads waiting behind this mutation.
			// Do not await reads that need the mutation to finish first.
			void invalidatePageResources(
				client,
				scope.actorKey,
				['loadConnectionsPage', 'loadConnectionUsagePage'],
				'active',
				{ orgSlug: scope.orgSlug },
			)
		},
	}
}

import { pageQueryOrg } from './page-query-scope.ts'
import { type QueryClient, type Query } from '@tanstack/react-query'
import { type PageResource } from './page-resources.ts'

export type PageMutationDependencies = readonly PageResource[] | 'permissions'

/** Permission policy changes can affect every resource. Ordinary writes name
 * their dependencies, including inactive cached pages visited later. */
export async function invalidatePageResources(
	client: QueryClient,
	actorKey: string | null,
	resources: PageMutationDependencies,
	refetchType: 'active' | 'none' = 'active',
	href?: string,
) {
	const org = href === undefined ? null : pageQueryOrg(href)
	const filters = {
		queryKey: ['page', actorKey],
		predicate: (query: Query) =>
			resources === 'permissions' ||
			(resources.some((resource) => query.queryKey[2] === resource) &&
				// Cross-surface actions may omit org identity. Invalidate their named
				// actor resources rather than silently missing every org cache.
				(org === null ||
					typeof query.queryKey[3] !== 'string' ||
					pageQueryOrg(query.queryKey[3]) === org)),
	}
	// A read started before the write must not satisfy its confirming refresh.
	// Keep uncached reads waiting on a pending mutation barrier alive, because
	// a navigation may already be awaiting that shared promise.
	await client.cancelQueries({
		...filters,
		predicate: (query) =>
			query.state.data !== undefined && filters.predicate(query),
	})
	await client.invalidateQueries({ ...filters, refetchType })
}

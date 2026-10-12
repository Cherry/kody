import { type QueryClient } from '@tanstack/react-query'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'

/** A mutation belongs to its initiating workspace even after navigation. */
export function orgPageFilters(
	actorKey: string | null,
	resource: string,
	href: string,
) {
	const pathname = new URL(href, 'http://localhost').pathname
	const orgSlug = orgSlugFromOrgOwnedPath(pathname)
	return {
		queryKey: ['page', actorKey, resource] as const,
		predicate: (query: { queryKey: readonly unknown[] }) => {
			const input = query.queryKey[3]
			if (typeof input !== 'string') return false
			const candidate = new URL(input, 'http://localhost').pathname
			const candidateOrg = orgSlugFromOrgOwnedPath(candidate)
			return orgSlug !== null
				? candidateOrg === orgSlug
				: candidateOrg === null && candidate.startsWith('/account/')
		},
	}
}

export function updateOrgPagePayload<T>(
	client: QueryClient,
	actorKey: string | null,
	resource: string,
	href: string,
	update: (payload: T) => T,
) {
	client.setQueriesData<{ payload: T }>(
		orgPageFilters(actorKey, resource, href),
		(data) => (data ? { ...data, payload: update(data.payload) } : data),
	)
}

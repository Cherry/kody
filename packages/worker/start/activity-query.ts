import { infiniteQueryOptions, type QueryClient } from '@tanstack/react-query'
import { loadActivityPage } from '#start/server/account-collections'

export function activityQuery(actorKey: string | null, href: string) {
	return infiniteQueryOptions({
		queryKey: ['page', actorKey, 'loadActivityPage', href] as const,
		initialPageParam: null as string | null,
		queryFn: ({ pageParam, signal }) => {
			const url = new URL(href, 'https://kody.local')
			if (pageParam !== null) url.searchParams.set('cursor', pageParam)
			return loadActivityPage({ data: `${url.pathname}${url.search}`, signal })
		},
		getNextPageParam: (lastPage) => lastPage.payload.nextCursor ?? undefined,
		staleTime: 10_000,
	})
}
export async function loadActivityQuery(
	client: QueryClient,
	actorKey: string | null,
	href: string,
) {
	const options = activityQuery(actorKey, href)
	const data = client.getQueryState(options.queryKey)?.isInvalidated
		? await client.fetchInfiniteQuery(options)
		: await client.ensureInfiniteQueryData({
				...options,
				revalidateIfStale: true,
			})
	return { head: data.pages[0]?.head, pageHeadQueryKey: options.queryKey }
}

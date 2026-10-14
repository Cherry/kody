import { infiniteQueryOptions, type QueryClient } from '@tanstack/react-query'
import { loadActivityPage } from '#start/server/account-collections'

export function activityQuery(actorKey: string | null, href: string) {
	return infiniteQueryOptions({
		meta: { actorKey },
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
	preload = false,
) {
	const options = activityQuery(actorKey, href)
	// A foreground entry must recheck organization membership. An older
	// preload flight must not satisfy that authorization check.
	if (!preload)
		await client.cancelQueries({ queryKey: options.queryKey, exact: true })
	const data = !preload
		? await client.fetchInfiniteQuery({ ...options, staleTime: 0 })
		: await client.ensureInfiniteQueryData({
				...options,
				revalidateIfStale: true,
			})
	return { head: data.pages[0]?.head, pageHeadQueryKey: options.queryKey }
}

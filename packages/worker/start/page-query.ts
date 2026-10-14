import {
	waitForPageMutations,
	hasPendingPageMutation,
} from './page-mutation-cache.ts'
import {
	queryOptions,
	useSuspenseQuery,
	type QueryKey,
	type QueryClient,
	type FetchQueryOptions,
	type UseSuspenseQueryOptions,
} from '@tanstack/react-query'
import { isNotFound } from '@tanstack/react-router'
import { type ResolvedDocumentHead } from '#universal/document-head.ts'

export type PageQueryPolicy<TInput = unknown> = {
	/** How long this resource can be reused without another read. */
	staleTime?: number
	gcTime?: number
	/** Entry must verify permissions even when an earlier preload is available. */
	freshAuthorization?: boolean | ((input: TInput) => boolean)
}

/** Query owns transport cancellation, independently of an individual navigation. */
export function createPageQuery<TInput, TData>(
	resource: string,
	read: (options: { data: TInput; signal: AbortSignal }) => Promise<TData>,
	policy: PageQueryPolicy<TInput> = {},
) {
	return (actorKey: string | null, input: TInput) =>
		queryOptions({
			queryKey: ['page', actorKey, resource, input] as const,
			queryFn: async ({ signal, client }) => {
				await waitForPageMutations(client, actorKey, resource, signal, input)
				return read({ data: input, signal })
			},
			staleTime: policy.staleTime ?? 30_000,
			gcTime: policy.gcTime ?? 5 * 60_000,
			meta: {
				actorKey,
				freshAuthorization:
					typeof policy.freshAuthorization === 'function'
						? policy.freshAuthorization(input)
						: policy.freshAuthorization === true,
			},
		})
}

/** Permission failures must replace a cached page, even on a background read. */
export function usePageQuery<TData, TKey extends QueryKey>(
	options: UseSuspenseQueryOptions<TData, Error, TData, TKey>,
) {
	const result = useSuspenseQuery(options)
	if (isNotFound(result.error)) throw result.error
	return result
}

/** Recheck access before reusing pages whose permissions can change independently of actor identity. */
export async function ensurePageQuery<TData, TKey extends QueryKey>(
	client: QueryClient,
	options: FetchQueryOptions<TData, Error, TData, TKey>,
	preload: boolean,
) {
	if (!preload && options.meta?.freshAuthorization === true) {
		// A preload may have read permissions before revocation. Its late result
		// must not satisfy the foreground authorization check.
		await client.cancelQueries({ queryKey: options.queryKey, exact: true })
		return client.fetchQuery({ ...options, staleTime: 0 })
	}
	const state = client.getQueryState(options.queryKey)
	const [, actorKey, resource, input] = options.queryKey
	// Focus can invalidate a cached optimistic page while its write is held.
	// That page stays navigable; its confirming read already waits on the
	// mutation barrier. An uncached page still waits for authoritative data.
	const pendingOptimisticPage =
		state?.data !== undefined &&
		hasPendingPageMutation(client, actorKey, resource, input)
	// Once the write settles, explicit invalidation waits for the confirmed
	// revision so Router metadata follows it. Elapsed age alone remains SWR.
	if (state?.isInvalidated && !pendingOptimisticPage)
		return client.fetchQuery(options)
	return client.ensureQueryData({ ...options, revalidateIfStale: true })
}

/** Router keeps the head fallback and exact cache reference, never a second page payload. */
export async function loadPageQuery<
	TData extends object,
	TKey extends QueryKey,
>(
	client: QueryClient,
	options: FetchQueryOptions<TData, Error, TData, TKey>,
	preload: boolean,
) {
	const data = await ensurePageQuery(client, options, preload)
	return {
		head: ('head' in data ? data.head : undefined) as
			| ResolvedDocumentHead
			| undefined,
		pageHeadQueryKey: options.queryKey,
	}
}

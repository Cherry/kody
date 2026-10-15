import { hashKey, type QueryKey, type QueryClient } from '@tanstack/react-query'
import { pageQueryInputOrg } from './page-query-scope.ts'
import {
	invalidatePageResources,
	type PageMutationDependencies,
} from './page-invalidation-cache.ts'
import { invalidateShellQueries } from './shell-query.ts'
import { type PageResource } from './page-resources.ts'

type Submission<TBody> = {
	body: TBody
	actorKey: string | null
	href: string
	queryKey: QueryKey
}
type Page<T> = { payload: T; [key: string]: unknown }

/** Cache callbacks belong to the mutation, not the lifetime of its form. */
export function acceptedPageMutationOptions<TBody, TResponse>(
	client: QueryClient,
	options: {
		resource: PageResource
		send: (submission: Submission<TBody>) => Promise<TResponse>
		dependencyScope?: 'actor' | 'org'
		dependencies?: PageMutationDependencies
		refreshShell?: boolean
		merge?: (page: Page<TResponse>, accepted: TResponse) => Page<TResponse>
	},
) {
	function filters({ actorKey, queryKey }: Submission<TBody>) {
		return {
			queryKey: ['page', actorKey, queryKey[2]],
			predicate: (query: { queryKey: readonly unknown[] }) =>
				pageQueryInputOrg(query.queryKey[3]) === pageQueryInputOrg(queryKey[3]),
		}
	}
	async function reconcileDependencies(
		submission: Submission<TBody>,
		snapshot: typeof options,
	) {
		if (snapshot.dependencies)
			await invalidatePageResources(
				client,
				submission.actorKey,
				snapshot.dependencies,
				'active',
				snapshot.dependencyScope === 'actor' ||
					pageQueryInputOrg(submission.queryKey[3]) === null
					? undefined
					: { orgSlug: pageQueryInputOrg(submission.queryKey[3]) },
			)
		if (snapshot.refreshShell)
			await invalidateShellQueries(client, submission.actorKey)
	}
	return {
		onMutate: () => ({ ...options }),
		mutationFn: options.send,
		gcTime: 0,
		onSuccess: async (
			accepted: TResponse,
			submission: Submission<TBody>,
			snapshot: typeof options,
		) => {
			const scope = filters(submission)
			await client.cancelQueries({ queryKey: submission.queryKey, exact: true })
			client.setQueryData<Page<TResponse>>(submission.queryKey, (page) =>
				page
					? snapshot.merge
						? snapshot.merge(page, accepted)
						: { ...page, payload: accepted }
					: page,
			)
			await client.invalidateQueries({
				...scope,
				predicate: (query) =>
					scope.predicate(query) &&
					query.queryHash !== hashKey(submission.queryKey),
			})
			await reconcileDependencies(submission, snapshot)
		},
		onError: async (
			_error: unknown,
			submission: Submission<TBody>,
			snapshot: typeof options | undefined,
		) => {
			// Losing a response does not prove that the server rolled back the write.
			await client.invalidateQueries(filters(submission))
			if (snapshot) await reconcileDependencies(submission, snapshot)
		},
	}
}

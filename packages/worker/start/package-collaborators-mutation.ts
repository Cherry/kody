import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { invalidatePageResources } from './page-invalidation-cache.ts'
import { type PackageCollaboratorsChange } from '#universal/package-collaborators.ts'

export function collaboratorsMutationKey(
	actorKey: string | null,
	page: { username: string; kodyId: string },
) {
	return ['packageCollaborators', actorKey, page.username, page.kodyId] as const
}

export type CollaboratorsMutationInput = {
	key: string
	change: PackageCollaboratorsChange
}

export function collaboratorsMutationOptions<TResult>(
	client: QueryClient,
	actorKey: string | null,
	page: { username: string; kodyId: string },
	send: (input: CollaboratorsMutationInput) => Promise<TResult>,
) {
	return mutationOptions({
		mutationKey: collaboratorsMutationKey(actorKey, page),
		retry: false,
		gcTime: 0,
		mutationFn: send,
		onSettled: async () => {
			// Permission changes can affect any resource for this actor. Reads
			// remain independent of writes, including a first navigation read.
			await Promise.allSettled(
				client
					.getQueryCache()
					.findAll({
						predicate: (query) =>
							query.meta?.actorKey === actorKey &&
							query.state.data === undefined &&
							query.state.fetchStatus === 'fetching',
					})
					.map((query) => query.promise),
			)
			// A lost response can still represent a committed permission change.
			// Confirm inactive pages too before dropping the pending UI state.
			await invalidatePageResources(client, actorKey, 'permissions', 'all')
		},
	})
}

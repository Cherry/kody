import { type QueryClient } from '@tanstack/react-query'

export function pageResourceKey(actorKey: string | null, resource: string) {
	return ['page', actorKey, resource] as const
}

export async function snapshotPageResource<T>(
	client: QueryClient,
	actorKey: string | null,
	resource: string,
	update: (data: T) => T,
	keyTail: readonly unknown[] = [],
) {
	const queryKey = [...pageResourceKey(actorKey, resource), ...keyTail]
	await client.cancelQueries({ queryKey })
	const snapshot = client.getQueriesData<T>({ queryKey })
	client.setQueriesData<T>({ queryKey }, (data) => data && update(data))
	return snapshot
}

export function restorePageResource<T>(
	client: QueryClient,
	snapshot: Array<readonly [readonly unknown[], T | undefined]> | undefined,
) {
	for (const [key, data] of snapshot ?? []) {
		if (data !== undefined) client.setQueryData(key, data)
	}
}

/** Shared by navigation and transport so both recognize the same write barrier. */
export function hasPendingPageMutation(
	client: QueryClient,
	actorKey: unknown,
	resource: unknown,
) {
	const mutation =
		resource === 'loadAccountPage' || resource === 'loadProfile'
			? 'profile'
			: resource === 'loadJobsPage'
				? 'jobs'
				: resource === 'loadEmailPage'
					? 'email'
					: null
	return (
		mutation !== null &&
		client.isMutating({ mutationKey: [mutation, actorKey] }) > 0
	)
}

/** A background refetch must not replace an optimistic value with pre-write data. */
export async function waitForPageMutations(
	client: QueryClient,
	actorKey: string | null,
	resource: string,
	signal: AbortSignal,
) {
	const pending = () => hasPendingPageMutation(client, actorKey, resource)
	if (signal.aborted) throw signal.reason
	if (!pending()) return
	await new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			unsubscribe()
			signal.removeEventListener('abort', abort)
		}
		const abort = () => {
			cleanup()
			reject(signal.reason)
		}
		const check = () => {
			if (!pending()) {
				cleanup()
				resolve()
			}
		}
		const unsubscribe = client.getMutationCache().subscribe(check)
		signal.addEventListener('abort', abort, { once: true })
		if (signal.aborted) abort()
		else check()
	})
}

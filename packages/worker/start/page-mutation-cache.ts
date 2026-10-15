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
	input?: unknown,
) {
	const mutations: Record<string, string[]> = {
		loadAccountPage: ['profile', 'accountConnections'],
		loadProfile: ['profile'],
		loadJobsPage: ['jobs'],
		loadValuesPage: ['values'],
		loadWorkflowsPage: ['workflows'],
		loadConnectionsPage: ['connectedAgents', 'connectionProfiles'],
		loadConnectionUsagePage: ['connectedAgents', 'connectionProfiles'],
		loadMcpServersPage: ['mcpServers'],
		loadSecretProvidersPage: ['secretProviders'],
		loadIntegrationsPage: ['integrations'],
		loadPackageWebhooks: ['packageWebhooks'],
		loadPackageCollaborators: ['packageCollaborators'],
	}
	return (
		typeof resource === 'string' &&
		(mutations[resource] ?? []).some(
			(mutation) =>
				client.isMutating({
					mutationKey: [mutation, actorKey],
					predicate: ({ options }) => {
						if (mutation === 'profile' || mutation === 'accountConnections')
							return true
						const key = options.mutationKey
						if (
							(mutation === 'packageWebhooks' ||
								mutation === 'packageCollaborators') &&
							input &&
							typeof input === 'object' &&
							'username' in input &&
							'kodyId' in input
						)
							return key?.[2] === input.username && key?.[3] === input.kodyId
						if (input && typeof input === 'object' && 'orgSlug' in input)
							return key?.[2] === input.orgSlug

						return true
					},
				}) > 0,
		)
	)
}

/** A background refetch must not replace an optimistic value with pre-write data. */
export async function waitForPageMutations(
	client: QueryClient,
	actorKey: string | null,
	resource: string,
	signal: AbortSignal,
	input?: unknown,
) {
	const pending = () =>
		hasPendingPageMutation(client, actorKey, resource, input)
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

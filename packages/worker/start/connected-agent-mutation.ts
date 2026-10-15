import { toast } from '#client/toast.ts'
import { revokeConnectedAgent } from '#start/server/account-mutations'
import { type AccountConnectedAgentsLoaderData } from '#universal/loader-data.ts'
import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { orgPageFilters, updateOrgPagePayload } from './org-page-cache.ts'

export function connectedAgentMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		gcTime: 0,
		mutationFn: async ({
			clientId,
			orgSlug,
		}: {
			clientId: string
			orgSlug: string | null
			actorKey: string | null
		}) => {
			await revokeConnectedAgent({
				data: {
					orgSlug: orgSlug ?? undefined,
					clientId,
				},
			})
		},
		onMutate: async ({ actorKey, clientId, orgSlug }) => {
			const filters = orgPageFilters(actorKey, 'loadConnectionsPage', {
				orgSlug,
			})
			await queryClient.cancelQueries(filters)
			const removed = queryClient
				.getQueriesData<{ payload: AccountConnectedAgentsLoaderData }>(filters)
				.map(([key, data]) => ({
					key,
					agent: data?.payload.agents.find(
						(agent) => agent.clientId === clientId,
					),
				}))
			updateOrgPagePayload<AccountConnectedAgentsLoaderData>(
				queryClient,
				actorKey,
				'loadConnectionsPage',
				{ orgSlug },
				(payload) => ({
					...payload,
					agents: payload.agents.filter((agent) => agent.clientId !== clientId),
				}),
			)
			return removed
		},
		onSuccess: () => {
			toast.success('Agent disconnected.')
		},
		onError: (error, _variables, removed) => {
			for (const { key, agent } of removed ?? [])
				if (agent)
					queryClient.setQueryData<{
						payload: AccountConnectedAgentsLoaderData
					}>(key, (data) =>
						data &&
						!data.payload.agents.some(
							(item) => item.clientId === agent.clientId,
						)
							? {
									...data,
									payload: {
										...data.payload,
										agents: [...data.payload.agents, agent],
									},
								}
							: data,
					)
			toast.error(error.message)
		},
		onSettled: (_data, _error, { actorKey, orgSlug }) => {
			if (
				queryClient.isMutating({
					mutationKey: ['connectedAgents', actorKey, orgSlug],
				}) === 1
			)
				for (const resource of [
					'loadConnectionsPage',
					'loadConnectionUsagePage',
				] as const)
					void queryClient.invalidateQueries(
						orgPageFilters(actorKey, resource, { orgSlug }),
					)
		},
	})
}

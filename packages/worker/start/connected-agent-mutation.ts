import { toast } from '#client/toast.ts'
import { updateConnectedAgents } from '#start/server/account-mutations'
import { type AccountConnectedAgentsLoaderData } from '#universal/loader-data.ts'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'
import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { orgPageFilters, updateOrgPagePayload } from './org-page-cache.ts'
import { pageQueryOrg } from './page-query-scope.ts'

export function connectedAgentMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		mutationFn: async ({
			clientId,
			href,
		}: {
			clientId: string
			href: string
			actorKey: string | null
		}) => {
			await updateConnectedAgents({
				data: {
					orgSlug: pageQueryOrg(href) ?? undefined,
					body: { intent: 'revoke', clientId },
				},
			})
		},
		onMutate: async ({ actorKey, clientId, href }) => {
			const filters = orgPageFilters(actorKey, 'loadConnectionsPage', href)
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
				href,
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
		onSettled: (_data, _error, { actorKey, href }) => {
			const orgSlug = orgSlugFromOrgOwnedPath(
				new URL(href, 'http://localhost').pathname,
			)
			if (
				queryClient.isMutating({
					mutationKey: ['connectedAgents', actorKey, orgSlug],
				}) === 1
			)
				void queryClient.invalidateQueries(
					orgPageFilters(actorKey, 'loadConnectionsPage', href),
				)
		},
	})
}

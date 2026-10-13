import {
	queryOptions,
	mutationOptions,
	type QueryClient,
} from '@tanstack/react-query'
import { type AdminOrgLimits } from '#universal/loader-data.ts'
import {
	type LimitOverrideKey,
	type LimitOverrideValue,
} from '#universal/plans.ts'
import { routes } from '#universal/routes.ts'
import { buildAdminUsersApiRequestUrl } from '#client/routes/admin-users-shared.ts'
import { invalidatePageResources } from './page-invalidation-cache.ts'

async function readResponse<T>(response: Response): Promise<T> {
	const payload = (await response.json()) as T & {
		ok?: boolean
		error?: string
	}
	if (!response.ok || !payload.ok)
		throw new Error(
			payload.error ??
				(response.status === 401
					? 'Please sign in again.'
					: 'Unable to save these changes.'),
		)
	return payload
}
export function adminOrgLimitsQuery(actorKey: string | null, orgId: string) {
	return queryOptions({
		queryKey: ['admin-org', actorKey, orgId, 'limits'] as const,
		queryFn: ({ signal }) =>
			fetch(
				`${routes.adminOrgLimitsApi.href()}?orgId=${encodeURIComponent(orgId)}`,
				{
					signal,
					credentials: 'include',
					headers: { Accept: 'application/json' },
				},
			).then(readResponse<AdminOrgLimits>),
	})
}
export type LimitChange = {
	key: LimitOverrideKey
	value: LimitOverrideValue | null
	expiresAt: string | null
}
export function adminOrgLimitMutationOptions(client: QueryClient) {
	return mutationOptions({
		retry: false,
		gcTime: 0,
		mutationFn: async (input: {
			actorKey: string | null
			orgId: string
			change: LimitChange
			reason: string
		}) =>
			readResponse<AdminOrgLimits>(
				await fetch(routes.adminOrgLimitsApi.href(), {
					method: 'POST',
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						orgId: input.orgId,
						changes: [input.change],
						reason: input.reason,
					}),
				}),
			),
		onSuccess: async (data, input) => {
			const queryKey = adminOrgLimitsQuery(input.actorKey, input.orgId).queryKey
			await client.cancelQueries({ queryKey, exact: true })
			client.setQueryData(queryKey, data)
		},
		onSettled: async (_data, _error, input) => {
			await Promise.all([
				client.invalidateQueries({
					queryKey: adminOrgLimitsQuery(input.actorKey, input.orgId).queryKey,
					exact: true,
				}),
				invalidatePageResources(client, input.actorKey, [
					'loadAdminUsers',
					'loadAdminInsights',
				]),
			])
		},
	})
}
export function adminDestinationMutationOptions(client: QueryClient) {
	return mutationOptions({
		retry: false,
		gcTime: 0,
		mutationFn: async (input: {
			actorKey: string | null
			stableUserId: string
			destinationEmail: string
			href: string
		}) =>
			readResponse(
				await fetch(buildAdminUsersApiRequestUrl(input.href), {
					method: 'POST',
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						action: 'mark_email_destination_verified',
						stableUserId: input.stableUserId,
						destinationEmail: input.destinationEmail,
					}),
				}),
			),
		onSettled: async (_data, _error, input) => {
			await Promise.all([
				invalidatePageResources(client, input.actorKey, ['loadAdminUsers']),
				client.invalidateQueries({
					queryKey: ['admin-users-pages', input.actorKey],
				}),
				client.invalidateQueries({
					queryKey: ['admin-user', input.actorKey, input.stableUserId],
				}),
			])
		},
	})
}

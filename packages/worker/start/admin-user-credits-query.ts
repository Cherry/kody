import {
	queryOptions,
	mutationOptions,
	type QueryClient,
} from '@tanstack/react-query'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { adminUserCreditsApiPath } from '#client/routes/admin-users-shared.ts'
import { type AdminCreditWalletSummary } from '#universal/loader-data.ts'

export function adminCreditWalletQuery(
	actorKey: string | null,
	stableUserId: string,
) {
	return queryOptions({
		queryKey: ['admin-user', actorKey, stableUserId, 'credits'] as const,
		queryFn: async ({ signal }) => {
			const response = await fetch(
				`${adminUserCreditsApiPath}?stableUserId=${encodeURIComponent(stableUserId)}`,
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal,
				},
			)
			const payload = await readJson<AdminCreditWalletSummary>(response)
			if (!response.ok || !payload?.ok)
				throw new Error('Unable to load credits for this account.')
			return payload
		},
	})
}
export function adminCreditGrantOptions(
	client: QueryClient,
	reconcile: () => Promise<void>,
) {
	return mutationOptions({
		mutationFn: async (input: {
			actorKey: string | null
			stableUserId: string
			amountCents: number
			note?: string
		}) => {
			const response = await fetch(adminUserCreditsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					stableUserId: input.stableUserId,
					amountCents: input.amountCents,
					note: input.note,
				}),
			})
			const payload = await readJson<
				AdminCreditWalletSummary & { error?: string }
			>(response)
			if (!response.ok || !payload?.ok)
				throw new Error(payload?.error ?? 'Unable to grant credits.')
			return payload
		},
		onMutate: () => reconcile,
		onSuccess: async (payload, input) => {
			const queryKey = adminCreditWalletQuery(
				input.actorKey,
				input.stableUserId,
			).queryKey
			await client.cancelQueries({ queryKey, exact: true })
			client.setQueryData(queryKey, payload)
		},
		onSettled: async (_data, _error, input, submittedReconcile) => {
			await Promise.all([
				client.invalidateQueries({
					queryKey: ['admin-user', input.actorKey, input.stableUserId],
				}),
				submittedReconcile?.(),
			])
		},
		gcTime: 0,
	})
}

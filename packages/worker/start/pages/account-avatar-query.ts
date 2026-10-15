import { type QueryClient } from '@tanstack/react-query'
import { type updateAvatar } from '#start/server/account-mutations'
import { type loadAccountPage } from '#start/server/account-page'
import { invalidateShellQueries } from '../shell-query.ts'

type Submission = {
	actorKey: string | null
	href: string
	username: string
	file?: File
}
type AccountData = Awaited<ReturnType<typeof loadAccountPage>>
export function avatarMutationOptions(
	client: QueryClient,
	send: (
		input: Submission,
	) => Promise<Awaited<ReturnType<typeof updateAvatar>>>,
) {
	const accountKey = (input: Submission) =>
		['page', input.actorKey, 'loadAccountPage'] as const
	async function invalidateDependents(input: Submission) {
		await Promise.all([
			client.invalidateQueries({
				queryKey: [
					'page',
					input.actorKey,
					'loadProfile',
					{ username: input.username },
				],
			}),
			invalidateShellQueries(client, input.actorKey),
		])
	}
	return {
		mutationFn: send,
		gcTime: 0,
		retry: false,
		onSuccess: async (
			profile: Awaited<ReturnType<typeof updateAvatar>>,
			input: Submission,
		) => {
			await client.cancelQueries({ queryKey: accountKey(input) })
			client.setQueriesData<AccountData>(
				{ queryKey: accountKey(input) },
				(data) =>
					data
						? {
								...data,
								payloads: {
									...data.payloads,
									accountProfile: {
										...data.payloads.accountProfile,
										avatarUrl: profile.avatarUrl,
									},
								},
							}
						: data,
			)
			await invalidateDependents(input)
		},
		onError: async (_error: unknown, input: Submission) => {
			await Promise.all([
				client.invalidateQueries({ queryKey: accountKey(input) }),
				invalidateDependents(input),
			])
		},
	}
}

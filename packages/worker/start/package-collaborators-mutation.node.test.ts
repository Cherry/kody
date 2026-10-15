import { QueryClient, queryOptions } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { collaboratorsMutationOptions } from './package-collaborators-mutation.ts'

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((next) => {
		resolve = next
	})
	return { promise, resolve }
}

for (const lostResponse of [false, true]) {
	for (const finishReadBeforeWrite of [false, true]) {
		test(`confirms inactive permission reads, lost response=${lostResponse}, early read=${finishReadBeforeWrite}`, async () => {
			const client = new QueryClient({
				defaultOptions: { queries: { retry: false } },
			})
			const write = deferred<void>()
			const firstRead = deferred<string>()
			const committedWrite = deferred<void>()
			let reads = 0
			let committed = false
			const query = queryOptions({
				queryKey: [
					'page',
					'owner',
					'loadPackageCollaborators',
					{ username: 'team', kodyId: 'demo' },
				],
				meta: { actorKey: 'owner' },
				queryFn: () =>
					++reads === 1
						? firstRead.promise
						: Promise.resolve(committed ? 'revoked' : 'granted'),
			})
			const otherActor = queryOptions({
				queryKey: [
					'page',
					'other',
					'loadPackageCollaborators',
					{ username: 'team', kodyId: 'demo' },
				],
				meta: { actorKey: 'other' },
				queryFn: async () => 'other actor',
			})
			await client.fetchQuery(otherActor)
			const mutation = client.getMutationCache().build(
				client,
				collaboratorsMutationOptions(
					client,
					'owner',
					{ username: 'team', kodyId: 'demo' },
					async () => {
						await write.promise
						committed = true
						committedWrite.resolve()
						if (lostResponse) throw new Error('lost response')
						return 'accepted'
					},
				),
			)
			const settlement = mutation
				.execute({
					key: 'revoke:g',
					change: { intent: 'revoke', grantId: 'g' },
				})
				.catch((error: Error) => error.message)
			const navigation = client.fetchQuery(query)
			if (finishReadBeforeWrite) {
				firstRead.resolve('granted')
				await expect(navigation).resolves.toBe('granted')
			}
			write.resolve()
			await committedWrite.promise
			await Promise.resolve()
			if (!finishReadBeforeWrite) {
				firstRead.resolve('granted')
				await expect(navigation).resolves.toBe('granted')
			}
			await expect(settlement).resolves.toBe(
				lostResponse ? 'lost response' : 'accepted',
			)
			expect(reads).toBe(2)
			expect(client.getQueryData(query.queryKey)).toBe('revoked')
			expect(client.getQueryState(otherActor.queryKey)?.isInvalidated).toBe(
				false,
			)
			expect(mutation.state.status).toBe(lostResponse ? 'error' : 'success')
			client.clear()
		})
	}
}

for (const change of [
	{ intent: 'invite', invitee: 'friend@example.com', preset: 'use' },
	{ intent: 'revoke-invite', inviteId: 'invite-one' },
] as const) {
	test(`${change.intent} confirms its package after a lost response without refreshing another package or actor`, async () => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const page = { username: 'owner', kodyId: 'submitted' }
		const reads = new Map<string, number>()
		for (const [actor, kodyId] of [
			['owner', 'submitted'],
			['owner', 'other-package'],
			['other-actor', 'submitted'],
		]) {
			await client.fetchQuery({
				queryKey: [
					'page',
					actor,
					'loadPackageCollaborators',
					{ username: 'owner', kodyId },
				],
				meta: { actorKey: actor },
				queryFn: async () => {
					const key = `${actor}/${kodyId}`
					reads.set(key, (reads.get(key) ?? 0) + 1)
					return reads.get(key)
				},
			})
		}
		const options = collaboratorsMutationOptions(
			client,
			'owner',
			page,
			async () => {
				throw new Error('lost response')
			},
		)
		const mutation = client.getMutationCache().build(client, options)
		await expect(
			mutation.execute({ key: change.intent, change }),
		).rejects.toThrow('lost response')
		expect(reads.get('owner/submitted')).toBe(2)
		expect(reads.get('owner/other-package')).toBe(1)
		expect(reads.get('other-actor/submitted')).toBe(1)
		expect(options.mutationKey).toEqual([
			'packageCollaborators',
			'owner',
			'owner',
			'submitted',
		])
		expect(options.gcTime).toBe(0)
		client.clear()
	})
}

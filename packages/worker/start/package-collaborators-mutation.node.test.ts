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

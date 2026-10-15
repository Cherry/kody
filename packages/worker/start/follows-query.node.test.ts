import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'
vi.mock('#start/server/follows', () => ({
	loadOrgFollows: vi.fn(),
	loadPackageFollow: vi.fn(),
}))
import { followsKeys, followMutationOptions } from './follows-query.ts'

test.each([false, true])(
	'settlement reconciles captured workspace and viewer target states, lost response=%s',
	async (lostResponse) => {
		const client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})
		const team = followsKeys.org('alice', 'team')
		const other = followsKeys.org('alice', 'other')
		const bob = followsKeys.org('bob', 'team')
		const target = followsKeys.target('alice', {
			username: 'owner',
			kodyId: 'repo',
		})
		for (const key of [team, other, bob, target])
			client.setQueryData(key, { old: true })
		let finish!: () => void
		const operation = new Promise<void>((resolve) => {
			finish = resolve
		})
		const mutation = new MutationObserver(
			client,
			followMutationOptions(
				client,
				'alice',
				async (_input: { orgSlug: string }) => {
					await operation
					if (lostResponse) throw new Error('Response lost')
					return { ok: true }
				},
			),
		)
		const pending = mutation.mutate({ orgSlug: 'team' }).catch((error) => error)
		await Promise.resolve()
		mutation.setOptions(
			followMutationOptions(
				client,
				'bob',
				async (_input: { orgSlug: string }) => ({ ok: true }),
			),
		)
		finish()
		await pending
		expect(client.getQueryState(team)?.isInvalidated).toBe(true)
		expect(client.getQueryState(target)?.isInvalidated).toBe(true)
		expect(client.getQueryState(other)?.isInvalidated).toBe(false)
		expect(client.getQueryState(bob)?.isInvalidated).toBe(false)
		client.clear()
	},
)

test('uncached navigation keeps its first promise then gets a confirming read after settlement', async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const key = followsKeys.org('alice', 'team')
	let finish!: () => void
	const first = new Promise<string>((resolve) => {
		finish = () => resolve('old')
	})
	const read = vi
		.fn()
		.mockImplementationOnce(() => first)
		.mockResolvedValue('new')
	const navigation = client.fetchQuery({ queryKey: key, queryFn: read })
	const mutation = new MutationObserver(
		client,
		followMutationOptions(
			client,
			'alice',
			async (_input: { orgSlug: string }) => ({ ok: true }),
		),
	)
	const pending = mutation.mutate({ orgSlug: 'team' })
	await Promise.resolve()
	finish()
	await expect(navigation).resolves.toBe('old')
	await pending
	expect(read).toHaveBeenCalledTimes(2)
	expect(client.getQueryData(key)).toBe('new')
	client.clear()
})

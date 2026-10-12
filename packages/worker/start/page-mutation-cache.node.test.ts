import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
	pageResourceKey,
	snapshotPageResource,
	restorePageResource,
	waitForPageMutations,
} from './page-mutation-cache.ts'

describe('page mutation cache', () => {
	it('optimistically updates every cached variant for one actor and rolls them back', async () => {
		const client = new QueryClient()
		const key = [...pageResourceKey('a', 'loadJobsPage'), '/account/jobs']
		const detailKey = [
			...pageResourceKey('a', 'loadJobsPage'),
			'/account/jobs/one',
		]
		const otherActor = [
			...pageResourceKey('b', 'loadJobsPage'),
			'/account/jobs',
		]
		client.setQueryData(key, { name: 'old' })
		client.setQueryData(detailKey, { name: 'detail' })
		client.setQueryData(otherActor, { name: 'other' })
		const snapshot = await snapshotPageResource<{ name: string }>(
			client,
			'a',
			'loadJobsPage',
			(data) => ({ ...data, name: 'pending' }),
		)
		expect(client.getQueryData(key)).toEqual({ name: 'pending' })
		expect(client.getQueryData(detailKey)).toEqual({ name: 'pending' })
		expect(client.getQueryData(otherActor)).toEqual({ name: 'other' })
		restorePageResource(client, snapshot)
		expect(client.getQueryData(key)).toEqual({ name: 'old' })
		expect(client.getQueryData(detailKey)).toEqual({ name: 'detail' })
		client.clear()
	})
	it('cancels an older read before applying the optimistic snapshot', async () => {
		const client = new QueryClient()
		const key = [...pageResourceKey('a', 'loadAccountPage'), '']
		client.setQueryData(key, { name: 'before' })
		let resolveRead: (value: { name: string }) => void = () => {}
		const read = client
			.fetchQuery({
				queryKey: key,
				queryFn: () =>
					new Promise<{ name: string }>((resolve) => {
						resolveRead = resolve
					}),
				staleTime: 0,
			})
			.catch(() => undefined)
		await snapshotPageResource<{ name: string }>(
			client,
			'a',
			'loadAccountPage',
			() => ({ name: 'pending' }),
		)
		resolveRead({ name: 'stale response' })
		await read
		expect(client.getQueryData(key)).toEqual({ name: 'pending' })
		client.clear()
	})
})

describe('reads during optimistic writes', () => {
	it('waits for matching writes, without blocking another actor', async () => {
		const client = new QueryClient()
		let finish: () => void = () => {}
		const mutation = client.getMutationCache().build(client, {
			mutationKey: ['profile', 'a'],
			mutationFn: () =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		})
		const write = mutation.execute(undefined)
		await Promise.resolve()
		const controller = new AbortController()
		let ready = false
		const read = waitForPageMutations(
			client,
			'a',
			'loadProfile',
			controller.signal,
		).then(() => {
			ready = true
		})
		await waitForPageMutations(client, 'b', 'loadProfile', controller.signal)
		expect(ready).toBe(false)
		finish()
		await write
		await read
		expect(ready).toBe(true)
		client.clear()
	})
	it('cancels a waiting read when Query aborts it', async () => {
		const client = new QueryClient()
		let finish: () => void = () => {}
		const mutation = client.getMutationCache().build(client, {
			mutationKey: ['jobs', 'a'],
			mutationFn: () =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		})
		const write = mutation.execute(undefined)
		await Promise.resolve()
		const controller = new AbortController()
		const read = waitForPageMutations(
			client,
			'a',
			'loadJobsPage',
			controller.signal,
		)
		controller.abort(new Error('obsolete read'))
		await expect(read).rejects.toThrow('obsolete read')
		expect(client.getMutationCache().hasListeners()).toBe(false)
		finish()
		await write
		client.clear()
	})
})

it('releases waiting reads after a failed mutation and removes its subscription', async () => {
	const client = new QueryClient()
	let fail: (error: Error) => void = () => {}
	const mutation = client.getMutationCache().build(client, {
		mutationKey: ['profile', 'a'],
		mutationFn: () =>
			new Promise<void>((_resolve, reject) => {
				fail = reject
			}),
	})
	const write = mutation.execute(undefined).catch(() => undefined)
	await Promise.resolve()
	const read = waitForPageMutations(
		client,
		'a',
		'loadAccountPage',
		new AbortController().signal,
	)
	expect(client.getMutationCache().hasListeners()).toBe(true)
	fail(new Error('rejected'))
	await write
	await read
	expect(client.getMutationCache().hasListeners()).toBe(false)
	client.clear()
})

it('can limit optimism to one public profile across cached search variants', async () => {
	const client = new QueryClient()
	const own = [
		...pageResourceKey('a', 'loadProfile'),
		{ username: 'alice', search: '' },
	]
	const ownSearch = [
		...pageResourceKey('a', 'loadProfile'),
		{ username: 'alice', search: '?q=x' },
	]
	const other = [
		...pageResourceKey('a', 'loadProfile'),
		{ username: 'bob', search: '' },
	]
	for (const key of [own, ownSearch, other])
		client.setQueryData(key, { name: 'before' })
	await snapshotPageResource<{ name: string }>(
		client,
		'a',
		'loadProfile',
		() => ({ name: 'pending' }),
		[{ username: 'alice' }],
	)
	expect(client.getQueryData(own)).toEqual({ name: 'pending' })
	expect(client.getQueryData(ownSearch)).toEqual({ name: 'pending' })
	expect(client.getQueryData(other)).toEqual({ name: 'before' })
	client.clear()
})

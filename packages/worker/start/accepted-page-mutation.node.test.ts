import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { acceptedPageMutationOptions } from './accepted-page-mutation.ts'

test('accepted response reconciles the submitted actor and org after unmount', async () => {
	const client = new QueryClient()
	const key = ['page', 'actor-a', 'loadValuesPage', { orgSlug: 'team-a' }]
	const otherOrg = ['page', 'actor-a', 'loadValuesPage', { orgSlug: 'team-b' }]
	const otherActor = [
		'page',
		'actor-b',
		'loadValuesPage',
		{ orgSlug: 'team-a' },
	]
	for (const queryKey of [key, otherOrg, otherActor])
		client.setQueryData(queryKey, { payload: { ok: true, revision: 1 } })
	let finish!: (value: { ok: boolean; revision: number }) => void
	const mutation = new MutationObserver(
		client,
		acceptedPageMutationOptions<unknown, { ok: boolean }>(client, {
			resource: 'loadValuesPage',
			send: () =>
				new Promise<{ ok: boolean; revision: number }>((resolve) => {
					finish = resolve
				}),
		}),
	)
	const unsubscribe = mutation.subscribe(() => {})
	const saving = mutation.mutate({
		actorKey: 'actor-a',
		href: '/@team-a/-/values',
		queryKey: key,
		body: {},
	})
	await Promise.resolve()
	unsubscribe()
	finish({ ok: true, revision: 2 })
	await saving
	expect(client.getQueryData(key)).toEqual({
		payload: { ok: true, revision: 2 },
	})
	for (const queryKey of [otherOrg, otherActor]) {
		expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false)
		expect(client.getQueryData(queryKey)).toEqual({
			payload: { ok: true, revision: 1 },
		})
	}
	client.clear()
})

test('uncertain mutation failures invalidate the submitted page and preserve its cached data', async () => {
	const client = new QueryClient()
	const key = ['page', 'actor-a', 'loadAdminFeatureFlags', undefined]
	client.setQueryData(key, { payload: { ok: true } })
	const mutation = new MutationObserver(
		client,
		acceptedPageMutationOptions(client, {
			resource: 'loadAdminFeatureFlags',
			send: async () => {
				throw new Error('Response lost')
			},
		}),
	)
	await expect(
		mutation.mutate({
			actorKey: 'actor-a',
			href: '/admin/feature-flags',
			queryKey: key,
			body: {},
		}),
	).rejects.toThrow('Response lost')
	expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	expect(client.getQueryData(key)).toEqual({ payload: { ok: true } })
	client.clear()
})

test('an older read cannot replace an accepted response', async () => {
	const client = new QueryClient()
	const queryKey = [
		'page',
		'actor',
		'loadExperimentsPage',
		'/account/experiments',
	]
	client.setQueryData(queryKey, {
		payload: { ok: true, experimentsOptIn: false },
	})
	let finishRead!: (value: unknown) => void
	const reading = client
		.fetchQuery({
			queryKey,
			queryFn: ({ signal }) => {
				void signal
				return new Promise((resolve) => {
					finishRead = resolve
				})
			},
		})
		.catch(() => null)
	const mutation = new MutationObserver(
		client,
		acceptedPageMutationOptions(client, {
			resource: 'loadExperimentsPage',
			send: async () => ({ ok: true, experimentsOptIn: true }),
		}),
	)
	await mutation.mutate({
		actorKey: 'actor',
		href: '/account/experiments',
		queryKey,
		body: {},
	})
	finishRead({ payload: { ok: true, experimentsOptIn: false } })
	await reading
	expect(client.getQueryData(queryKey)).toEqual({
		payload: { ok: true, experimentsOptIn: true },
	})
	client.clear()
})

test('different query inputs share invalidation, never an accepted payload', async () => {
	const client = new QueryClient()
	const queryKey = ['page', 'actor', 'loadAccountSecurity', 'two-factor']
	const sibling = ['page', 'actor', 'loadAccountSecurity', 'passkeys']
	client.setQueryData(queryKey, {
		page: 'two-factor',
		payload: { enabled: false },
	})
	client.setQueryData(sibling, {
		page: 'passkeys',
		payload: { passkeys: [{ id: 'keep' }] },
	})
	const mutation = new MutationObserver(
		client,
		acceptedPageMutationOptions(client, {
			resource: 'loadAccountSecurity',
			send: async () => ({ enabled: true }),
		}),
	)
	await mutation.mutate({
		actorKey: 'actor',
		href: '/account/two-factor',
		queryKey,
		body: {},
	})
	expect(client.getQueryData(queryKey)).toEqual({
		page: 'two-factor',
		payload: { enabled: true },
	})
	expect(client.getQueryData(sibling)).toEqual({
		page: 'passkeys',
		payload: { passkeys: [{ id: 'keep' }] },
	})
	expect(client.getQueryState(sibling)?.isInvalidated).toBe(true)
	client.clear()
})

test('lost permission-write responses reconcile submitted dependencies and shell after observer options change', async () => {
	const client = new QueryClient()
	const queryKey = ['page', 'a', 'loadAdminFeatureFlags', undefined]
	const dependency = ['page', 'a', 'loadValuesPage', { orgSlug: 'team' }]
	const shell = ['shell', 'a', 'default']
	const otherActor = ['page', 'b', 'loadValuesPage', { orgSlug: 'team' }]
	for (const key of [queryKey, dependency, shell, otherActor]) {
		client.setQueryDefaults(key, { meta: { actorKey: key[1] } })
		client.setQueryData(key, { payload: { ok: true } })
	}
	let fail!: (error: Error) => void
	let started!: () => void
	const ready = new Promise<void>((resolve) => {
		started = resolve
	})
	const observer = new MutationObserver(
		client,
		acceptedPageMutationOptions(client, {
			resource: 'loadAdminFeatureFlags',
			dependencies: 'permissions',
			refreshShell: true,
			send: () => {
				started()
				return new Promise<{ ok: boolean }>((_resolve, reject) => {
					fail = reject
				})
			},
		}),
	)
	const unsubscribe = observer.subscribe(() => {})
	const pending = observer.mutate({
		body: {},
		actorKey: 'a',
		href: '/admin/feature-flags',
		queryKey,
	})
	await ready
	observer.setOptions(
		acceptedPageMutationOptions<unknown, { ok: boolean }>(client, {
			resource: 'loadValuesPage',
			send: async () => ({ ok: true }),
		}),
	)
	unsubscribe()
	fail(new Error('Connection lost after commit'))
	await expect(pending).rejects.toThrow('Connection lost after commit')
	for (const key of [queryKey, dependency, shell])
		expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	expect(client.getQueryState(otherActor)?.isInvalidated).toBe(false)
	client.clear()
})

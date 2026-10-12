import { QueryClient, MutationObserver } from '@tanstack/react-query'
import { expect, test } from 'vitest'
import { avatarMutationOptions } from './account-avatar-query.ts'
import { type AccountProfileLoaderData } from '#universal/loader-data.ts'

test('avatar completion after unmount updates only submitted actor avatar, preserving newer profile edits', async () => {
	const client = new QueryClient()
	const key = ['page', 'a', 'loadAccountPage', '/account']
	const other = ['page', 'b', 'loadAccountPage', '/account']
	const original = {
		payloads: {
			accountProfile: { displayName: 'Newer name', avatarUrl: 'old.png' },
		},
	}
	client.setQueryData(key, original)
	client.setQueryData(other, original)
	let finish!: (value: AccountProfileLoaderData) => void
	let started!: () => void
	const ready = new Promise<void>((resolve) => {
		started = resolve
	})
	const observer = new MutationObserver(
		client,
		avatarMutationOptions(client, () => {
			started()
			return new Promise((resolve) => {
				finish = resolve
			})
		}),
	)
	const unsubscribe = observer.subscribe(() => {})
	const pending = observer.mutate({
		actorKey: 'a',
		href: '/account',
		username: 'alice',
	})
	await ready
	unsubscribe()
	finish({
		ok: true,
		displayName: 'Older name',
		avatarUrl: 'new.png',
	} as AccountProfileLoaderData)
	await pending
	expect(client.getQueryData(key)).toEqual({
		payloads: {
			accountProfile: { displayName: 'Newer name', avatarUrl: 'new.png' },
		},
	})
	expect(client.getQueryData(other)).toEqual(original)
	client.clear()
})

test('uncertain avatar response invalidates account, public profile and shell for submitted actor', async () => {
	const client = new QueryClient()
	const keys = [
		['page', 'a', 'loadAccountPage', '/account'],
		['page', 'a', 'loadProfile', { username: 'alice' }],
		['shell', 'a', 'default'],
	]
	for (const key of keys) client.setQueryData(key, {})
	const observer = new MutationObserver(
		client,
		avatarMutationOptions(client, async () => {
			throw new Error('Disconnected')
		}),
	)
	await expect(
		observer.mutate({ actorKey: 'a', href: '/account', username: 'alice' }),
	).rejects.toThrow('Disconnected')
	for (const key of keys)
		expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	client.clear()
})

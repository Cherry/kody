import { afterEach, expect, test, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { packageMutationOptions } from './package-mutation-cache.ts'

afterEach(() => vi.unstubAllGlobals())
test('an accepted package write updates its original cache after the form unmounts, without touching another actor', async () => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	const first = [
		'page',
		'actor-a',
		'loadPackage',
		{ username: 'a', kodyId: 'repo', page: 'settings' },
	]
	const second = [
		'page',
		'actor-b',
		'loadPackage',
		{ username: 'a', kodyId: 'repo', page: 'settings' },
	]
	const initial = {
		kind: 'page',
		data: {
			ownerPackage: { id: 'repo-id', lockedAt: null },
			username: 'a',
			kodyId: 'repo',
		},
	}
	client.setQueryData(first, initial)
	client.setQueryData(second, initial)
	let release!: (response: Response) => void
	vi.stubGlobal(
		'fetch',
		vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					release = resolve
				}),
		),
	)
	const observer = new MutationObserver(client, packageMutationOptions(client))
	const unsubscribe = observer.subscribe(() => {})
	const write = observer.mutate({
		actorKey: 'actor-a',
		packageId: 'repo-id',
		body: { action: 'lock' },
	})
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
	unsubscribe()
	release(
		Response.json({
			ok: true,
			selectedPackage: { id: 'repo-id', lockedAt: '2026-10-12T00:00:00Z' },
		}),
	)
	await write
	expect(client.getQueryData(first)).toMatchObject({
		data: { ownerPackage: { lockedAt: '2026-10-12T00:00:00Z' } },
	})
	expect(client.getQueryData(second)).toEqual(initial)
	await vi.waitFor(() =>
		expect(client.getQueryState(first)?.isInvalidated).toBe(true),
	)
	expect(client.getQueryState(second)?.isInvalidated).toBe(false)
	client.clear()
})
test('a lost visibility response invalidates affected reads even after the form unmounts', async () => {
	const client = new QueryClient()
	const key = ['page', 'actor-a', 'loadProfile', { username: 'a' }]
	client.setQueryData(key, { old: true })
	vi.stubGlobal(
		'fetch',
		vi.fn().mockRejectedValue(new Error('Network connection lost')),
	)
	const observer = new MutationObserver(client, packageMutationOptions(client))
	const unsubscribe = observer.subscribe(() => {})
	const write = observer.mutate({
		actorKey: 'actor-a',
		packageId: 'repo-id',
		body: { action: 'set-visibility' },
	})
	unsubscribe()
	await expect(write).rejects.toThrow('Network connection lost')
	await vi.waitFor(() =>
		expect(client.getQueryState(key)?.isInvalidated).toBe(true),
	)
	client.clear()
})

test('capability approval submits the reviewed fingerprint to its captured canonical API and reconciles an uncertain response', async () => {
	const client = new QueryClient()
	const key = [
		'page',
		'owner',
		'loadPackage',
		{ username: 'team', kodyId: 'example', page: 'settings' },
	]
	client.setQueryData(key, {
		kind: 'page',
		data: { ownerPackage: { id: 'pkg' } },
	})
	const request = vi.fn().mockRejectedValue(new Error('Response lost'))
	vi.stubGlobal('fetch', request)
	const observer = new MutationObserver(client, packageMutationOptions(client))
	await expect(
		observer.mutate({
			actorKey: 'owner',
			packageId: 'pkg',
			apiPath: '/@team/example/approve-capabilities.json',
			body: { action: 'approve-capabilities', fingerprint: 'reviewed' },
		}),
	).rejects.toThrow('Response lost')
	expect(request).toHaveBeenCalledWith(
		'/@team/example/approve-capabilities.json',
		expect.objectContaining({
			body: JSON.stringify({
				action: 'approve-capabilities',
				fingerprint: 'reviewed',
				packageId: 'pkg',
			}),
		}),
	)
	expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	client.clear()
})

test('internet-visible approval-required failures preserve the review URL', async () => {
	vi.stubGlobal(
		'fetch',
		vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					ok: false,
					error: 'Review required',
					approvalUrl: '/@team/example/approve-capabilities',
				}),
				{ status: 409 },
			),
		),
	)
	const client = new QueryClient()
	const observer = new MutationObserver(client, packageMutationOptions(client))
	await expect(
		observer.mutate({
			actorKey: 'owner',
			packageId: 'pkg',
			body: {
				action: 'set-internet-visible',
				internetVisible: true,
				confirmName: 'example',
			},
		}),
	).rejects.toMatchObject({
		message: 'Review required',
		approvalUrl: '/@team/example/approve-capabilities',
	})
	client.clear()
})

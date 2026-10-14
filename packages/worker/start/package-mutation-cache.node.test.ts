import { afterEach, expect, test, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
const { writePackage } = vi.hoisted(() => ({ writePackage: vi.fn() }))
vi.mock('#start/server/package-mutations', () => ({
	lockPackage: writePackage,
	unlockPackage: writePackage,
	approvePackagePublish: writePackage,
	setPackageVisibility: writePackage,
	setPackageInternetVisible: writePackage,
	approvePackageCapabilities: writePackage,
	approvePackageCredentialNeeds: writePackage,
	approvePackageWentPublic: writePackage,
	deletePackage: writePackage,
	adoptPackageFork: writePackage,
	absorbPackageListing: writePackage,
}))
import { packageMutationOptions } from './package-mutation-cache.ts'
afterEach(() => vi.resetAllMocks())
test('accepted writes reconcile the submitting actor after unmount', async () => {
	const client = new QueryClient()
	const key = [
		'page',
		'actor-a',
		'loadPackage',
		{ username: 'team', kodyId: 'repo' },
	]
	const other = [
		'page',
		'actor-b',
		'loadPackage',
		{ username: 'team', kodyId: 'repo' },
	]
	const before = {
		kind: 'page',
		data: { ownerPackage: { id: 'pkg', lockedAt: null } },
	}
	client.setQueryData(key, before)
	client.setQueryData(other, before)
	let finish!: (value: unknown) => void
	writePackage.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const observer = new MutationObserver(client, packageMutationOptions(client))
	const unsubscribe = observer.subscribe(() => {})
	const promise = observer.mutate({
		actorKey: 'actor-a',
		packageId: 'pkg',
		body: { action: 'lock' },
	})
	await vi.waitFor(() => expect(writePackage).toHaveBeenCalledOnce())
	unsubscribe()
	finish({
		ok: true,
		selectedPackage: { id: 'pkg', lockedAt: '2026-10-14T00:00:00Z' },
	})
	await promise
	expect(client.getQueryData(key)).toMatchObject({
		data: { ownerPackage: { lockedAt: '2026-10-14T00:00:00Z' } },
	})
	expect(client.getQueryData(other)).toEqual(before)
	expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	expect(client.getQueryState(other)?.isInvalidated).toBe(false)
	client.clear()
})
test.each([
	{ action: 'approve-capabilities', fingerprint: 'reviewed' },
	{ action: 'approve-credential-needs', requestId: 'request' },
	{ action: 'set-visibility', visibility: 'public', confirmName: 'repo' },
] as const)(
	'uncertain %s reconciles original reads without optimistic permission changes',
	async (body) => {
		const client = new QueryClient()
		const key = [
			'page',
			'actor',
			'loadPackage',
			{ username: 'team', kodyId: 'repo' },
		]
		const before = {
			kind: 'page',
			data: { ownerPackage: { id: 'pkg', publishedCommit: 'old' } },
		}
		client.setQueryData(key, before)
		writePackage.mockRejectedValue(new Error('Response lost'))
		const observer = new MutationObserver(
			client,
			packageMutationOptions(client),
		)
		await expect(
			observer.mutate({
				actorKey: 'actor',
				packageId: 'pkg',
				body,
			}),
		).rejects.toThrow('Response lost')
		expect(writePackage).toHaveBeenCalledWith({
			data: {
				packageId: 'pkg',
				...Object.fromEntries(
					Object.entries(body).filter(([key]) => key !== 'action'),
				),
			},
		})
		expect(client.getQueryData(key)).toEqual(before)
		expect(client.getQueryState(key)?.isInvalidated).toBe(true)
		client.clear()
	},
)
test('review-required errors retain the approval URL', async () => {
	writePackage.mockResolvedValue({
		ok: false,
		error: 'Review required',
		approvalUrl: '/@team/repo/approve-capabilities',
	})
	const client = new QueryClient()
	const observer = new MutationObserver(client, packageMutationOptions(client))
	await expect(
		observer.mutate({
			actorKey: 'actor',
			packageId: 'pkg',
			body: {
				action: 'set-internet-visible',
				internetVisible: true,
				confirmName: 'repo',
			},
		}),
	).rejects.toMatchObject({
		message: 'Review required',
		approvalUrl: '/@team/repo/approve-capabilities',
	})
	client.clear()
})

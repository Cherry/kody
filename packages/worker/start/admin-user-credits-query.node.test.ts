import { afterEach, expect, test, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import {
	adminCreditGrantOptions,
	adminCreditWalletQuery,
} from './admin-user-credits-query.ts'

afterEach(() => vi.unstubAllGlobals())

test('a grant finishing after selection and observer changes only reconciles the submitted wallet', async () => {
	const client = new QueryClient()
	const first = adminCreditWalletQuery('operator-a', 'user-a').queryKey
	const other = adminCreditWalletQuery('operator-a', 'user-b').queryKey
	const switched = adminCreditWalletQuery('operator-b', 'user-a').queryKey
	for (const key of [first, other, switched])
		client.setQueryData(key, { ok: true, balanceMicroUsd: 1 })
	let finish!: (response: Response) => void
	vi.stubGlobal(
		'fetch',
		vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					finish = resolve
				}),
		),
	)
	const reconcile = vi.fn(async () => {})
	const observer = new MutationObserver(
		client,
		adminCreditGrantOptions(client, reconcile),
	)
	const stop = observer.subscribe(() => {})
	const pending = observer.mutate({
		actorKey: 'operator-a',
		stableUserId: 'user-a',
		amountCents: 100,
	})
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
	stop()
	finish(Response.json({ ok: true, balanceMicroUsd: 2 }))
	await pending
	expect(client.getQueryData(first)).toEqual({ ok: true, balanceMicroUsd: 2 })
	expect(client.getQueryData(other)).toEqual({ ok: true, balanceMicroUsd: 1 })
	expect(client.getQueryData(switched)).toEqual({
		ok: true,
		balanceMicroUsd: 1,
	})
	expect(reconcile).toHaveBeenCalledOnce()
	client.clear()
})

test('a lost grant response invalidates the submitted wallet and usage without publishing uncertain data', async () => {
	const client = new QueryClient()
	const key = adminCreditWalletQuery('operator', 'user').queryKey
	client.setQueryData(key, { ok: true, balanceMicroUsd: 1 })
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => {
			throw new Error('Connection lost')
		}),
	)
	const reconcile = vi.fn(async () => {})
	const observer = new MutationObserver(
		client,
		adminCreditGrantOptions(client, reconcile),
	)
	await expect(
		observer.mutate({
			actorKey: 'operator',
			stableUserId: 'user',
			amountCents: 100,
		}),
	).rejects.toThrow('Connection lost')
	expect(client.getQueryState(key)?.isInvalidated).toBe(true)
	expect(reconcile).toHaveBeenCalledOnce()
	client.clear()
})

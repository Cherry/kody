import { QueryClient, MutationObserver } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ open: vi.fn(), checkout: vi.fn() }))
vi.mock('#start/server/billing-mutations', () => ({
	openBillingPortal: mocks.open,
	startCheckout: mocks.checkout,
}))
import {
	billingPortalMutationOptions,
	billingCheckoutMutationOptions,
} from './billing-checkout.ts'

test('portal mutation finishes after navigation without redirecting the retained page', async () => {
	const client = new QueryClient()
	let finish!: (value: { ok: true; url: string }) => void
	mocks.open.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const mutation = new MutationObserver(client, billingPortalMutationOptions)
	const unsubscribe = mutation.subscribe(() => {})
	let current = true
	const navigate = vi.fn()
	const pending = mutation.mutate('original-team', {
		onSuccess: (result) => {
			if (current) navigate(result.url)
		},
	})
	await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
	expect(mutation.getCurrentResult().isPending).toBe(true)
	current = false
	finish({ ok: true, url: 'https://billing.stripe.com/old-team' })
	await pending
	expect(mutation.getCurrentResult().isPending).toBe(false)
	expect(navigate).not.toHaveBeenCalled()
	expect(mocks.open).toHaveBeenCalledWith({
		data: { orgSlug: 'original-team' },
	})
	unsubscribe()
	client.clear()
})

test('checkout pending clears after navigation and retains submitted plan variables', async () => {
	const client = new QueryClient()
	let finish!: (value: { url: string }) => void
	mocks.checkout.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const mutation = new MutationObserver(client, billingCheckoutMutationOptions)
	const unsubscribe = mutation.subscribe(() => {})
	let current = true
	const navigate = vi.fn()
	const pending = mutation.mutate(
		{ orgSlug: 'original-team', plan: 'pro', interval: 'year', promoCode: '' },
		{
			onSuccess: (result) => {
				if (current && result.ok) navigate(result.url)
			},
		},
	)
	await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
	expect(mutation.getCurrentResult()).toMatchObject({
		isPending: true,
		variables: { orgSlug: 'original-team', plan: 'pro', interval: 'year' },
	})
	current = false
	finish({ url: 'https://checkout.stripe.com/old-team' })
	await pending
	expect(mutation.getCurrentResult().isPending).toBe(false)
	expect(navigate).not.toHaveBeenCalled()
	unsubscribe()
	client.clear()
})

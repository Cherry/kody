import { expect, test } from 'vitest'
import { startStripeMock } from './stripe-mock-server.ts'

test('Stripe simulator requires its disposable API token and only pays through hosted checkout', async () => {
	const mock = await startStripeMock()
	try {
		const endpoint = `${mock.origin}/v1/checkout/sessions`
		expect((await fetch(endpoint)).status).toBe(401)
		const headers = { authorization: `Bearer ${mock.token}` }
		const response = await fetch(endpoint, {
			method: 'POST',
			headers,
			body: new URLSearchParams({
				mode: 'payment',
				success_url:
					'http://localhost:3847/return?session_id={CHECKOUT_SESSION_ID}',
				cancel_url: 'http://localhost:3847/',
				client_reference_id: 'signed-reference',
				'metadata[kody_credit_top_up]': '1',
				'line_items[0][price_data][unit_amount]': '1000',
			}),
		})
		const session = (await response.json()) as { id: string; url: string }
		expect(response.status).toBe(200)
		const read = async () =>
			(await fetch(`${endpoint}/${session.id}`, { headers })).json()
		expect(await read()).toMatchObject({
			payment_status: 'unpaid',
			client_reference_id: 'signed-reference',
			metadata: { kody_credit_top_up: '1' },
		})
		const paid = await fetch(session.url, {
			method: 'POST',
			redirect: 'manual',
		})
		expect(paid.status).toBe(303)
		expect(paid.headers.get('location')).toBe(
			`http://localhost:3847/return?session_id=${session.id}`,
		)
		expect(await read()).toMatchObject({
			payment_status: 'paid',
			amount_total: 1000,
		})
	} finally {
		await mock.close()
	}
})

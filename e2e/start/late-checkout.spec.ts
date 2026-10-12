import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('leaving billing before checkout responds does not redirect the new page', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `checkout-${id}@example.com`,
		username: `checkout-${id}`,
	})
	await login({ ...user, mode: 'login' })
	await page.goto(`/@${user.username}/-/billing`)
	await waitForClientHydration(page)
	let release!: () => void
	let captured!: () => void
	const held = new Promise<void>((resolve) => {
		captured = resolve
	})
	const barrier = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/billing/checkout.json', async (route) => {
		captured()
		await barrier
		await route.fulfill({
			json: {
				ok: true,
				url: 'https://example.com/obsolete-checkout',
				mode: 'checkout',
			},
		})
	})
	try {
		await page
			.getByRole('button', { name: 'Switch to Pro', exact: true })
			.first()
			.click()
		await held
		await page
			.getByRole('navigation', { name: 'Main', exact: true })
			.getByRole('link', { name: 'Docs', exact: true })
			.click()
		await expect(page).toHaveURL(/\/docs$/)
		const response = page.waitForResponse((response) =>
			new URL(response.url()).pathname.endsWith('/billing/checkout.json'),
		)
		release()
		await response
		await page.waitForLoadState('networkidle')
		await expect(page).toHaveURL(/\/docs$/)
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

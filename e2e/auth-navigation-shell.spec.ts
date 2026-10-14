import { expect, test, waitForClientHydration } from './playwright-utils.ts'
import { requestNamesDestination } from './server-function-requests.ts'

test('login keeps the current page chrome until its destination is ready', async ({
	page,
}) => {
	await page.context().clearCookies()
	await page.goto('/features/packages')
	await waitForClientHydration(page)
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	let requested = false
	await page.route('**/_serverFn/**', async (route) => {
		if (requestNamesDestination(route.request(), '/login')) {
			requested = true
			await held
		}
		await route.continue()
	})
	const navigation = page.getByRole('navigation', { name: 'Main', exact: true })
	const main = page.locator('main')
	const padding = await main.evaluate(
		(element) => getComputedStyle(element).padding,
	)
	try {
		await navigation.getByRole('link', { name: 'Log in', exact: true }).click()
		await expect.poll(() => requested).toBe(true)
		await expect(navigation).toBeVisible()
		await expect(page.getByRole('heading', { level: 1 })).toContainText(
			'Keep the software',
		)
		await expect(main).toHaveCSS('padding', padding)
	} finally {
		release()
	}
	await expect(
		page.getByRole('button', { name: 'Sign in', exact: true }),
	).toBeVisible()
	await expect(navigation).toHaveCount(0)
})

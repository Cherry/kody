import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('onboarding polls one shared query across steps and pauses while hidden', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `onboarding-query-${id}@example.com`,
		username: `onboarding-query-${id}`,
	})
	await login({ ...user, mode: 'login' })
	// Install before Query mounts so the poll interval uses the controlled clock.
	await page.clock.install()
	await page.goto('/onboarding/step-1')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	const reads: Array<string> = []
	page.on('request', (request) => {
		if (request.url().includes('/_serverFn/')) reads.push(request.url())
	})
	await page.clock.runFor(4100)
	await expect.poll(() => reads.length).toBe(1)
	await page.waitForLoadState('networkidle')
	const progressUrl = reads[0]
	for (const step of [2, 3, 1]) {
		await page.evaluate(
			(step) => window.history.pushState(null, '', `/onboarding/step-${step}`),
			step,
		)
		await expect(page).toHaveURL(new RegExp(`/onboarding/step-${step}$`))
		await expect(
			page.getByRole('navigation', { name: 'Onboarding steps' }),
		).toBeVisible()
		await page.waitForLoadState('networkidle')
	}
	expect(reads.filter((url) => url === progressUrl)).toHaveLength(1)
	await page.evaluate(() => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'hidden',
		})
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			get: () => true,
		})
		document.dispatchEvent(new Event('visibilitychange'))
	})
	await page.clock.runFor(12_000)
	expect(reads.filter((url) => url === progressUrl)).toHaveLength(1)
})

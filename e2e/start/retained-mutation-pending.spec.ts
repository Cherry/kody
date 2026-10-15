import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

for (const suffix of ['#pending-review', '?review=pending']) {
	test(`retained admin form releases pending state after navigating to ${suffix}`, async ({
		page,
		seedE2eUser,
		login,
	}) => {
		const id = randomUUID().slice(0, 8)
		const user = await seedE2eUser({
			email: `pending-${id}@example.com`,
			username: `pending-${id}`,
			admin: true,
		})
		await login({ ...user, mode: 'login' })
		await page.goto('/admin/reserved-usernames')
		await waitForClientHydration(page)
		const name = `reserved-${id}`
		const input = page.getByLabel('Usernames', { exact: true })
		await input.fill(name)
		// Keep the actual accepted write response in flight while the same route
		// remains mounted at another search/fragment location.
		let release!: () => void
		const barrier = new Promise<void>((resolve) => {
			release = resolve
		})
		let captured = false
		let responseHeld = false
		await page.route('**/_serverFn/**', async (route) => {
			if (
				captured ||
				route.request().method() !== 'POST' ||
				!route.request().postData()?.includes(name)
			)
				return route.fallback()
			captured = true
			const response = await route.fetch()
			responseHeld = true
			await barrier
			await route.fulfill({ response })
		})
		try {
			await page.getByRole('button', { name: 'Add', exact: true }).click()
			await expect.poll(() => responseHeld).toBe(true)
			await expect(input).toBeDisabled()
			await page.evaluate(
				(next) => window.history.pushState(null, '', next),
				`/admin/reserved-usernames${suffix}`,
			)
			await expect(page).toHaveURL(
				new RegExp(suffix.replace(/[?]/g, '\\?') + '$'),
			)
			release()
			await expect(input).toBeEnabled()
			await expect(
				page.getByRole('button', { name: 'Add', exact: true }),
			).toBeEnabled()
			// The departed submission must not clear the retained draft or announce
			// success at the new location, even though its pending state is finished.
			await expect(input).toHaveValue(name)
			await expect(
				page.getByText('Reserved usernames updated.', { exact: true }),
			).toHaveCount(0)
			const row = page.getByText(name, { exact: true }).locator('..')
			await row.getByRole('button', { name: 'Remove', exact: true }).click()
			await expect(
				page.getByText('Reserved username removed.', { exact: true }),
			).toBeVisible()
		} finally {
			release()
		}
	})
}

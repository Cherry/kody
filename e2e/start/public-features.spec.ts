import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('home to memory and Back keeps outgoing feature CSS until its content leaves', async ({
	page,
}) => {
	await page.goto('/')
	await waitForClientHydration(page)
	const origin = await page.evaluate(() => performance.timeOrigin)
	await page.locator('a[href="/features/memory"]').first().click()
	await expect(page.locator('.feature-detail .memory')).toBeVisible()
	await expect(page.locator('.feature-detail')).toHaveCSS('--hue', '29')
	await page.evaluate(() => {
		const samples: boolean[] = []
		Object.assign(window, { featureStyleSamples: samples })
		function sample() {
			const feature = document.querySelector('.feature-detail')
			if (!feature) return
			samples.push(
				getComputedStyle(feature).getPropertyValue('--hue').trim() === '29',
			)
			requestAnimationFrame(sample)
		}
		sample()
	})
	await page.goBack()
	await expect(page).toHaveURL(/\/$/)
	await expect(page.locator('.feature-detail')).toHaveCount(0)
	const samples = await page.evaluate(
		() =>
			(window as unknown as { featureStyleSamples: boolean[] })
				.featureStyleSamples,
	)
	expect(samples.length).toBeGreaterThan(0)
	expect(samples.every(Boolean)).toBe(true)
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin)
})

test('memory demo updates both views and app intake saves a trimmed brief with focus', async ({
	page,
}) => {
	await page.goto('/features/memory')
	await waitForClientHydration(page)
	await page.getByRole('button', { name: 'Make updates more detailed' }).click()
	await expect(page.locator('#ms-hero-note')).toContainText(
		'Include the decision, the reason, and the next step.',
	)
	await expect(page.locator('#ms-updated-note')).toContainText(
		'Include the decision, the reason, and the next step.',
	)
	await page.goto('/features/apps')
	await waitForClientHydration(page)
	await page.getByLabel('Project name').fill('  Native Start demo  ')
	await page.locator('.study form button[type="submit"]').click()
	await expect(page.locator('#saved-brief-heading')).toHaveText(
		'Native Start demo',
	)
	await expect(page.locator('#saved-brief-heading')).toBeFocused()
	await page.getByRole('button', { name: 'New brief', exact: true }).click()
	await page.getByLabel('Project name').fill('Second demo')
	await page.locator('.study form button[type="submit"]').click()
	await expect(page.locator('#saved-brief-heading')).toHaveText('Second demo')
})

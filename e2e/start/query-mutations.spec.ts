import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

for (const { outcome, prewarm } of [
	{ outcome: 'accepted', prewarm: true },
	{ outcome: 'rejected', prewarm: true },
	{ outcome: 'accepted', prewarm: false },
	{ outcome: 'rejected', prewarm: false },
] as const) {
	test(`profile optimism survives navigation and ${outcome === 'accepted' ? 'persists after' : 'rolls back after'} a held write${prewarm ? '' : ' on an uncached profile'}`, async ({
		page,
		seedE2eUser,
		login,
	}) => {
		const id = randomUUID().slice(0, 8)
		const user = await seedE2eUser({
			email: `query-${id}@example.com`,
			username: `query-${id}`,
		})
		await login({ ...user, mode: 'login' })
		await page.goto('/account')
		await waitForClientHydration(page)
		await page.clock.install()
		const original = await page
			.getByLabel('Display name', { exact: true })
			.inputValue()
		const originalBio = await page
			.getByRole('textbox', { name: 'Bio', exact: true })
			.inputValue()
		if (prewarm) {
			await page
				.getByRole('link', { name: 'View public profile', exact: true })
				.click()
			await expect(page.getByTestId('profile-display-name')).toHaveText(
				original,
			)
			await page
				.getByRole('link', { name: 'Edit profile', exact: true })
				.click()
			await expect(
				page.getByLabel('Display name', { exact: true }),
			).toHaveValue(original)
		}

		await page.evaluate(() => {
			document.documentElement.dataset.queryMutationDocument = 'original'
		})
		const nextName = `Optimistic ${id}`
		const nextBio = `Changed before the server responds ${id}`
		let release!: () => void
		let captured!: () => void
		const barrier = new Promise<void>((resolve) => {
			release = resolve
		})
		const held = new Promise<void>((resolve) => {
			captured = resolve
		})
		await page.route('**/account/profile.json', async (route) => {
			if (route.request().method() !== 'POST') return route.continue()
			captured()
			await barrier
			if (outcome === 'rejected')
				return route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Controlled failed profile save' }),
				})
			await route.continue()
		})
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		try {
			await page.getByLabel('Display name', { exact: true }).fill(nextName)
			await page
				.getByRole('textbox', { name: 'Bio', exact: true })
				.fill(nextBio)
			await page
				.getByRole('button', { name: 'Save profile', exact: true })
				.click()
			const writeResponse = page.waitForResponse(
				(response) =>
					new URL(response.url()).pathname === '/account/profile.json' &&
					response.request().method() === 'POST',
			)
			await held
			const serverBefore = await page.request.get('/account/profile.json')
			expect((await serverBefore.json()).displayName).toBe(original)
			await page
				.getByRole('link', { name: 'View public profile', exact: true })
				.click()
			if (!prewarm) release()
			const intermediateName =
				!prewarm && outcome === 'rejected' ? original : nextName
			const intermediateBio =
				!prewarm && outcome === 'rejected' ? originalBio : nextBio
			await expect(page.getByTestId('profile-display-name')).toHaveText(
				intermediateName,
			)
			if (intermediateBio)
				await expect(page.getByTestId('profile-bio')).toHaveText(
					intermediateBio,
				)
			else await expect(page.getByTestId('profile-bio')).toHaveCount(0)
			await page.clock.fastForward(61_000)
			await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')))
			await page
				.getByRole('link', { name: 'Edit profile', exact: true })
				.click()
			await expect(
				page.getByLabel('Display name', { exact: true }),
			).toHaveValue(intermediateName)
			await page
				.getByRole('link', { name: 'View public profile', exact: true })
				.click()
			await expect(page.getByTestId('profile-display-name')).toHaveText(
				intermediateName,
			)
			release()
			await writeResponse
			await expect(page.getByTestId('profile-display-name')).toHaveText(
				outcome === 'accepted' ? nextName : original,
			)
			await expect(page).toHaveTitle(
				outcome === 'accepted' ? nextName : original,
			)
			if (outcome === 'rejected')
				await expect(
					page
						.getByRole('alert')
						.filter({ hasText: 'Controlled failed profile save' }),
				).toBeVisible()
			await expect(page.locator('html')).toHaveAttribute(
				'data-query-mutation-document',
				'original',
			)
			await page
				.getByRole('link', { name: 'Edit profile', exact: true })
				.click()
			await expect(
				page.getByLabel('Display name', { exact: true }),
			).toHaveValue(outcome === 'accepted' ? nextName : original)
			await expect(
				page.getByRole('textbox', { name: 'Bio', exact: true }),
			).toHaveValue(outcome === 'accepted' ? nextBio : originalBio)
			const bio = page.getByRole('textbox', { name: 'Bio', exact: true })
			await expect(bio).toHaveAccessibleName('Bio')
			const labels = await bio.evaluate((element) => {
				if (!(element instanceof HTMLTextAreaElement))
					throw new Error('Expected textarea')
				return Array.from(element.labels ?? []).map((label) => ({
					text: label.textContent,
					caption: label.querySelector('span')?.textContent,
				}))
			})
			expect(labels).toHaveLength(1)
			expect(labels[0]?.caption).toBe('Bio')
			test.info().annotations.push({
				type: 'bio-label-association',
				description: JSON.stringify(labels),
			})
			await page.reload()
			await waitForClientHydration(page)
			await expect(
				page.getByLabel('Display name', { exact: true }),
			).toHaveValue(outcome === 'accepted' ? nextName : original)
			expect(errors).toEqual([])
		} finally {
			release()
			await page.unrouteAll({ behavior: 'wait' })
		}
	})
}

test('profile drafts preserve edits while untouched fields follow background changes', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `query-draft-${id}@example.com`,
		username: `query-draft-${id}`,
	})
	await login({ ...user, mode: 'login' })
	await page.goto('/account')
	await waitForClientHydration(page)
	await page.clock.install()
	const displayName = page.getByLabel('Display name', { exact: true })
	const bio = page.getByRole('textbox', { name: 'Bio', exact: true })
	await displayName.fill(`Unsaved ${id}`)
	const currentResponse = await page.request.get('/account/profile.json')
	const current = await currentResponse.json()
	const updatedBio = `Saved in another session ${id}`
	const response = await page.request.post('/account/profile.json', {
		data: {
			username: current.username,
			displayName: current.displayName,
			bio: updatedBio,
			profileVisibility: current.profileVisibility,
		},
	})
	expect(response.ok()).toBe(true)
	await page.clock.fastForward(61_000)
	await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')))
	await expect(bio).toHaveValue(updatedBio)
	await expect(displayName).toHaveValue(`Unsaved ${id}`)
})

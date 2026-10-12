import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('saving job retention supersedes an older read and preserves later drafts', async ({
	page,
	seedE2eUser,
	login,
}, testInfo) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `jobs-order-${id}@example.com`,
		username: `jobs-order-${id}`,
	})
	await login({ ...user, mode: 'login' })
	await page.goto('/account/jobs')
	await waitForClientHydration(page)
	await page.clock.install()
	const input = page.getByLabel('Successful one-off (days)', { exact: true })
	const save = page.getByRole('button', {
		name: 'Save retention',
		exact: true,
	})
	const original = await input.inputValue()
	const updated = original === '17' ? '18' : '17'
	let release!: () => void
	const barrier = new Promise<void>((resolve) => {
		release = resolve
	})
	let captured!: () => void
	const capturedRead = new Promise<void>((resolve) => {
		captured = resolve
	})
	let hold = true
	const reads = { jobs: 0, other: 0 }
	await page.route('**/_serverFn/**', async (route) => {
		const response = await route.fetch()
		const body = await response.text()
		const jobs = body.includes('successOnceDays')
		if (jobs) reads.jobs++
		else reads.other++
		if (jobs && hold) {
			hold = false
			captured()
			await barrier
		}
		await route.fulfill({ response })
	})
	try {
		await page.clock.fastForward(11_000)
		await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')))
		await capturedRead
		await input.fill(updated)
		await save.click()
		// The action response is authoritative, so this variant needs no GET.
		await expect(
			page.getByText('Updated job retention preferences.', { exact: true }),
		).toBeVisible()
		await expect(input).toHaveValue(updated)
		await expect(
			page.getByText('Updated job retention preferences.', { exact: true }),
		).toBeVisible()
		await expect(save).toBeEnabled()
		await expect(input).toHaveValue(updated)
		release()
		await page.waitForLoadState('networkidle')
		await expect(input).toHaveValue(updated)
		expect(reads.jobs).toBe(1)
		testInfo.annotations.push({
			type: 'jobs-mutation-rpcs',
			description: JSON.stringify(reads),
		})
		const saved = await page.request.get('/account/jobs.json')
		expect(saved.ok()).toBe(true)
		expect((await saved.json()).retention.successOnceDays).toBe(Number(updated))
		await input.fill('19')
		const failedRetention = page.getByLabel(
			'Failed / never-ran one-off (days)',
			{
				exact: true,
			},
		)
		const nextFailedDays =
			(await failedRetention.inputValue()) === '23' ? 24 : 23
		const externalSave = await page.request.post('/account/jobs.json', {
			data: {
				action: 'update_retention',
				successOnceDays: Number(updated),
				failedOrNeverRanOnceDays: nextFailedDays,
				disabledRecurringDays: Number(
					await page
						.getByLabel('Disabled recurring (days)', { exact: true })
						.inputValue(),
				),
			},
		})
		expect(externalSave.ok()).toBe(true)
		const beforeRefresh = reads.jobs
		await page.clock.fastForward(11_000)
		await page.evaluate(() => window.dispatchEvent(new FocusEvent('focus')))
		await expect.poll(() => reads.jobs).toBe(beforeRefresh + 1)
		await page.waitForLoadState('networkidle')
		await expect(input).toHaveValue('19')
		await expect(failedRetention).toHaveValue(String(nextFailedDays))
		await page
			.getByRole('link', { name: 'Overview', exact: true })
			.first()
			.click()
		await expect(page.getByLabel('Display name', { exact: true })).toBeVisible()
		await page.goBack()
		await expect(input).toHaveValue(updated)
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

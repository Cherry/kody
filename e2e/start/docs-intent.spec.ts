import {
	collectJsonRequests,
	expectSingleCommitTransition,
	observeMainTransitions,
	readMainTransitions,
} from '../main-transitions.ts'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

for (const intent of ['hover', 'focus', 'touch'] as const) {
	test(`docs idle does not fetch the sidebar, ${intent} warms only the chosen article`, async ({
		page,
	}) => {
		const reads = collectJsonRequests(page)
		await page.goto('/docs/memory')
		await waitForClientHydration(page)
		await page.waitForLoadState('networkidle')
		// Count from document startup so eager reads during hydration cannot hide.
		expect(reads.paths).toEqual([])
		const link = page
			.getByRole('navigation', { name: 'Docs' })
			.first()
			.getByRole('link', { name: 'Secrets', exact: true })
		const loaded = page.waitForResponse(
			(response) =>
				response.url().includes('/_serverFn/') &&
				decodeURIComponent(response.url()).includes('"secrets"'),
		)
		if (intent === 'hover') await link.hover()
		else if (intent === 'focus') await link.focus()
		else await link.dispatchEvent('touchstart')
		await (await loaded).finished()
		await page.waitForLoadState('networkidle')
		expect(reads.forDoc('secrets')).toHaveLength(1)
		expect(reads.paths).toHaveLength(1)
		await observeMainTransitions(page)
		await link.click()
		await expect(
			page.getByRole('heading', { name: 'Secrets', exact: true }),
		).toBeVisible()
		await page.waitForLoadState('networkidle')
		expectSingleCommitTransition(await readMainTransitions(page), {
			fromHeading: 'Shared memory',
			toHeading: 'Secrets',
		})
		expect(reads.forDoc('secrets')).toHaveLength(1)
		expect(reads.paths).toHaveLength(1)
	})
}

test('a direct docs click without intent keeps its article until the cold read completes', async ({
	page,
}) => {
	await page.goto('/docs/memory')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	let started!: () => void
	const reading = new Promise<void>((resolve) => {
		started = resolve
	})
	await page.route('**/_serverFn/**', async (route) => {
		if (decodeURIComponent(route.request().url()).includes('"secrets"')) {
			started()
			await held
		}
		await route.continue()
	})
	try {
		await observeMainTransitions(page)
		// Native click activation without pointer hover or focus prewarming.
		await page
			.getByRole('navigation', { name: 'Docs' })
			.first()
			.getByRole('link', { name: 'Secrets', exact: true })
			.evaluate((link: HTMLAnchorElement) => link.click())
		await reading
		await expect(
			page.getByRole('heading', { name: 'Shared memory', exact: true }),
		).toBeVisible()
		await expect(
			page.getByRole('heading', { name: 'Secrets', exact: true }),
		).toHaveCount(0)
		release()
		await expect(
			page.getByRole('heading', { name: 'Secrets', exact: true }),
		).toBeVisible()
		expectSingleCommitTransition(await readMainTransitions(page), {
			fromHeading: 'Shared memory',
			toHeading: 'Secrets',
		})
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

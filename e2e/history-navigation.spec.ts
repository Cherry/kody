import {
	expect,
	test,
	waitForClientHydration,
	type Page,
} from './playwright-utils.ts'

type HistoryFrame = {
	path: string
	scrollY: number
	featureOnScreen: boolean
	featureStylesApplied: boolean
	homeOnScreen: boolean
}

type HistoryRecording = {
	frames: Array<HistoryFrame>
	viewTransitions: number
}

/**
 * Sample every animation frame from now until `stopHistoryRecording`. Back /
 * Forward must paint the destination styled and already at its restored
 * scroll position: no frame of feature content without its stylesheet, no
 * frame of the homepage away from its saved scroll, no view transition.
 */
async function startHistoryRecording(page: Page) {
	await page.evaluate(() => {
		const recording: HistoryRecording = { frames: [], viewTransitions: 0 }
		const start = document.startViewTransition?.bind(document)
		if (start) {
			document.startViewTransition = ((update) => {
				recording.viewTransitions += 1
				return start(update)
			}) as typeof document.startViewTransition
		}
		let recordingActive = true
		const sample = () => {
			if (!recordingActive) return
			const feature = document.querySelector('.feature-detail')
			const study = feature?.querySelector('.study')
			const split = feature?.querySelector('.split, .boundary')
			const expectedHue = feature?.querySelector('.memory') ? '29' : '300'
			const styled = Boolean(
				feature &&
				study &&
				split &&
				getComputedStyle(feature).getPropertyValue('--hue').trim() ===
					expectedHue &&
				getComputedStyle(split).display === 'grid' &&
				parseFloat(getComputedStyle(study).paddingTop) > 0,
			)
			recording.frames.push({
				path: location.pathname,
				scrollY: Math.round(window.scrollY),
				featureOnScreen: Boolean(document.querySelector('.feature-detail')),
				featureStylesApplied: styled,
				homeOnScreen: Boolean(
					document.querySelector('main a[href="/features/memory"]'),
				),
			})
			requestAnimationFrame(sample)
		}
		requestAnimationFrame(sample)
		Object.assign(window, {
			__kodyStopHistoryRecording: () => {
				recordingActive = false
				return recording
			},
		})
	})
}

function stopHistoryRecording(page: Page) {
	return page.evaluate(() =>
		(
			window as unknown as {
				__kodyStopHistoryRecording: () => HistoryRecording
			}
		).__kodyStopHistoryRecording(),
	)
}

async function expectFeatureStylesheetApplied(page: Page) {
	await expect(
		page.locator('.feature-detail .split, .feature-detail .boundary'),
	).toHaveCSS('display', 'grid')
	await expect
		.poll(() =>
			page
				.locator('.feature-detail')
				.evaluate((element) =>
					getComputedStyle(element).getPropertyValue('--hue').trim(),
				),
		)
		.toBe(new URL(page.url()).pathname.endsWith('/memory') ? '29' : '300')
	// Ensure the recorder observes the rendered destination, not only pending frames.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
			),
	)
}

function isFeatureModule(url: URL) {
	return (
		/\/assets\/features-[^/]+\.js$/.test(url.pathname) ||
		url.pathname.endsWith('/start/pages/features.tsx')
	)
}

async function holdFeatureModule(page: Page) {
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	let requested = false
	await page.route(isFeatureModule, async (route) => {
		requested = true
		await gate
		await route.continue()
	})
	return { release, wait: () => expect.poll(() => requested).toBe(true) }
}

function unstyledFeatureFrames(recording: HistoryRecording) {
	return recording.frames.filter(
		(frame) => frame.featureOnScreen && !frame.featureStylesApplied,
	)
}

// Warm the feature route chunk first: a cold Vite compile can outlast the
// router's navigation timeout and turn the click into a document load.
async function openWarmHomepage(
	page: Page,
	warmPaths: Array<string> = ['/features/memory'],
) {
	await page.context().clearCookies()
	for (const path of warmPaths) {
		await page.goto(path)
		await waitForClientHydration(page)
	}
	await page.goto('/')
	await waitForClientHydration(page)
	await page.evaluate(() => Object.assign(window, { __kodyBootDocument: true }))
}

test('a lantern link and Back/Forward paint styled and at the restored scroll', async ({
	page,
}) => {
	await openWarmHomepage(page)
	const held = await holdFeatureModule(page)

	const lanternLink = page
		.getByRole('main')
		.getByRole('link', { name: 'memory', exact: true })
	await lanternLink.scrollIntoViewIfNeeded()
	await expect
		.poll(() => page.evaluate(() => Math.round(window.scrollY)))
		.toBeGreaterThan(0)
	const homeScrollY = await page.evaluate(() => Math.round(window.scrollY))

	await startHistoryRecording(page)
	await lanternLink.click()
	await held.wait()
	await expect(lanternLink).toBeVisible()
	await expect(page.locator('.feature-detail')).toHaveCount(0)
	held.release()
	await expect(page).toHaveURL(/\/features\/memory$/)
	await expect(page.locator('.feature-detail')).toBeVisible()
	await expectFeatureStylesheetApplied(page)
	const click = await stopHistoryRecording(page)
	expect(
		await page.evaluate(() => '__kodyBootDocument' in window),
		'the lantern click stayed in the SPA',
	).toBe(true)
	expect(click.frames.some((frame) => frame.featureOnScreen)).toBe(true)
	expect(unstyledFeatureFrames(click), 'click painted unstyled').toEqual([])

	const documentRefetches: Array<string> = []
	page.on('request', (request) => {
		const url = new URL(request.url())
		if (
			url.pathname === '/' &&
			(request.headers().accept ?? '').includes('text/html')
		) {
			documentRefetches.push(`${request.method()} ${request.url()}`)
		}
	})

	await startHistoryRecording(page)
	await page.goBack()
	await expect(page).toHaveURL(/\/$/)
	await expect(lanternLink).toBeVisible()
	await expect
		.poll(() => page.evaluate(() => Math.round(window.scrollY)))
		.toBe(homeScrollY)
	const back = await stopHistoryRecording(page)
	expect(documentRefetches, 'Back refetched the whole document').toEqual([])
	expect(unstyledFeatureFrames(back), 'Back painted unstyled').toEqual([])
	expect(
		back.frames.filter(
			(frame) => frame.homeOnScreen && frame.scrollY !== homeScrollY,
		),
		'homepage painted away from its restored scroll position',
	).toEqual([])
	expect(back.viewTransitions).toBe(0)

	await startHistoryRecording(page)
	await page.goForward()
	await expect(page).toHaveURL(/\/features\/memory$/)
	await expect(page.locator('.feature-detail')).toBeVisible()
	await expectFeatureStylesheetApplied(page)
	const forward = await stopHistoryRecording(page)
	expect(forward.frames.some((frame) => frame.featureOnScreen)).toBe(true)
	expect(unstyledFeatureFrames(forward), 'Forward painted unstyled').toEqual([])
	expect(
		forward.frames.filter(
			(frame) => frame.featureOnScreen && frame.scrollY !== 0,
		),
		'feature page painted away from the top',
	).toEqual([])
	expect(forward.viewTransitions).toBe(0)
})

test('a superseding feature navigation waits for the shared styled component', async ({
	page,
}) => {
	await openWarmHomepage(page, ['/features/memory', '/features/secrets'])
	const held = await holdFeatureModule(page)
	const lantern = page.getByRole('main')
	await lantern
		.getByRole('link', { name: 'memory', exact: true })
		.scrollIntoViewIfNeeded()

	await startHistoryRecording(page)
	await lantern.getByRole('link', { name: 'memory', exact: true }).click()
	await held.wait()
	await expect(page.locator('.feature-detail')).toHaveCount(0)
	await lantern.getByRole('link', { name: 'secrets', exact: true }).click()
	await expect(page.locator('.feature-detail')).toHaveCount(0)
	held.release()
	await expect(page).toHaveURL(/\/features\/secrets$/)
	await expect(page.locator('.feature-detail')).toBeVisible()
	await expectFeatureStylesheetApplied(page)
	const recording = await stopHistoryRecording(page)

	expect(await page.evaluate(() => '__kodyBootDocument' in window)).toBe(true)
	expect(recording.frames.some((frame) => frame.featureOnScreen)).toBe(true)
	expect(
		recording.frames.filter(
			(frame) => frame.featureOnScreen && frame.path !== '/features/secrets',
		),
	).toEqual([])
	expect(unstyledFeatureFrames(recording), 'painted unstyled').toEqual([])
})

test('a feature component that fails to load recovers through a document load', async ({
	page,
}) => {
	const unexpectedErrors: string[] = []
	let abortedFeatureUrl: string | undefined
	page.on('pageerror', (error) => unexpectedErrors.push(error.message))
	page.on('console', (message) => {
		// Vite can report the failed dependency through its generated route chunk.
		const failedImportPrefix =
			'React client error: TypeError: Failed to fetch dynamically imported module: '
		if (message.text().startsWith(failedImportPrefix)) {
			const failedUrl = message.text().slice(failedImportPrefix.length)
			const memoryRouteChunk = new URL(
				'/packages/worker/start/routes/features_.memory.tsx?tsr-split=component',
				page.url(),
			).href
			if (
				abortedFeatureUrl &&
				(failedUrl === abortedFeatureUrl || failedUrl === memoryRouteChunk)
			)
				return
		}
		if (
			message.type() === 'error' &&
			message.text().includes('React client error:')
		) {
			unexpectedErrors.push(message.text())
		}
	})
	await openWarmHomepage(page)
	let componentRequests = 0
	await page.route(isFeatureModule, async (route) => {
		componentRequests += 1
		if (componentRequests === 1) {
			abortedFeatureUrl = route.request().url()
			await route.abort('failed')
			return
		}
		await route.continue()
	})

	// The router changes the URL before its failed import triggers a document
	// reload. Wait for that load, not the earlier same-document URL change.
	await Promise.all([
		page.waitForEvent('load'),
		page
			.getByRole('main')
			.getByRole('link', { name: 'memory', exact: true })
			.click(),
	])
	await expect(page).toHaveURL(/\/features\/memory$/)
	expect(await page.evaluate(() => '__kodyBootDocument' in window)).toBe(false)
	await expect(page.locator('.feature-detail')).toBeVisible()
	await expectFeatureStylesheetApplied(page)
	await waitForClientHydration(page)
	await expect.poll(() => componentRequests).toBe(2)
	expect(unexpectedErrors).toEqual([])
})

import { expect, test, waitForClientHydration } from '../playwright-utils.ts'
import {
	observeMainTransitions,
	readMainTransitions,
	expectSingleCommitTransition,
} from '../main-transitions.ts'

test('page navigation preserves selective motion and suppresses repeated homepage entrance', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await page.addInitScript(() => {
		Object.assign(window, { motionAnimations: [] as Array<string> })
		document.addEventListener('animationstart', (event) => {
			;(
				window as unknown as { motionAnimations: Array<string> }
			).motionAnimations.push(event.animationName)
		})
	})
	await page.goto('/')
	await waitForClientHydration(page)
	await expect(page.locator('html')).not.toHaveAttribute('data-spa-nav')
	const timeOrigin = await page.evaluate(() => performance.timeOrigin)
	const supported = await page.evaluate(
		() => typeof document.startViewTransition === 'function',
	)
	await page.locator('a[href="/pricing"]').first().click()
	await expect(page).toHaveURL(/\/pricing$/)
	await expect(page.locator('html')).toHaveAttribute('data-spa-nav', '')
	if (supported)
		await expect
			.poll(() =>
				page.evaluate(() =>
					(
						window as unknown as { motionAnimations: Array<string> }
					).motionAnimations.includes('vt-page-in'),
				),
			)
			.toBe(true)
	await page.locator('a[href="/"]').first().click()
	await expect(page).toHaveURL(/\/$/)
	await expect(page.locator('[data-rise]').first()).toHaveCSS(
		'animation-name',
		'none',
	)
	expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
	if (supported)
		await page.evaluate(() => {
			const original = document.startViewTransition.bind(document)
			let finish!: () => void
			const finished = new Promise<void>((resolve) => {
				finish = resolve
			})
			Object.assign(window, { enteringDocsFinished: finished })
			document.startViewTransition = (...args) => {
				document.startViewTransition = original
				const transition = original(...args)
				void transition.finished.then(finish, finish)
				return transition
			}
		})
	await page.locator('a[href="/docs"]').first().click()
	await expect(page).toHaveURL(/\/docs$/)
	// URL changes can precede animation creation. Wait for the actual transition.
	if (supported)
		await page.evaluate(
			() =>
				(window as unknown as { enteringDocsFinished: Promise<void> })
					.enteringDocsFinished,
		)
	await page.evaluate(() => {
		;(
			window as unknown as { motionAnimations: Array<string> }
		).motionAnimations = []
	})
	const beforeHeading = await page.locator('main h1').textContent()
	await observeMainTransitions(page)
	const guide = page.locator('main a[href^="/docs/"]').first()
	const guideHref = await guide.getAttribute('href')
	await guide.click()
	await expect.poll(() => new URL(page.url()).pathname).toBe(guideHref)
	await page.waitForLoadState('networkidle')
	const afterHeading = await page.locator('main h1').textContent()
	expectSingleCommitTransition(await readMainTransitions(page), {
		fromHeading: beforeHeading!,
		toHeading: afterHeading!,
	})
	expect(
		await page.evaluate(() =>
			(
				window as unknown as { motionAnimations: Array<string> }
			).motionAnimations.filter((name) => name.startsWith('vt-page')),
		),
	).toEqual([])
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.locator('a[href="/pricing"]').first().click()
	await expect(page).toHaveURL(/\/pricing$/)
	await page.waitForLoadState('networkidle')
	expect(
		await page.evaluate(() =>
			(
				window as unknown as { motionAnimations: Array<string> }
			).motionAnimations.filter((name) => name.startsWith('vt-page')),
		),
	).toEqual([])
})

test('a browser transition API failure cannot strand a ready page navigation', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await page.goto('/')
	await waitForClientHydration(page)
	await page.evaluate(() => {
		document.startViewTransition = (() => {
			throw new DOMException('Simulated busy transition', 'InvalidStateError')
		}) as typeof document.startViewTransition
	})
	await page.locator('a[href="/pricing"]').first().click()
	await expect(page).toHaveURL(/\/pricing$/)
	await expect(page.locator('main')).toContainText('Worker compute')
})

test('a superseded slow page cannot replace the later navigation or blank main', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' })
	await page.goto('/')
	await waitForClientHydration(page)
	const fromHeading = await page.locator('main h1').textContent()
	await observeMainTransitions(page)
	let release!: () => void
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	let started!: () => void
	const firstRequest = new Promise<void>((resolve) => {
		started = resolve
	})
	let held = false
	await page.route('**/_serverFn/**', async (route) => {
		if (!held) {
			held = true
			started()
			await gate
		}
		await route.continue()
	})
	try {
		await page.locator('a[href="/docs"]').first().click()
		await firstRequest
		await page.locator('a[href="/pricing"]').first().click()
		await expect(page).toHaveURL(/\/pricing$/)
		await expect(page.locator('main')).toContainText('Worker compute')
		release()
		await page.waitForLoadState('networkidle')
		await expect(page).toHaveURL(/\/pricing$/)
		expectSingleCommitTransition(await readMainTransitions(page), {
			fromHeading: fromHeading!,
			toHeading: (await page.locator('main h1').textContent())!,
		})
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

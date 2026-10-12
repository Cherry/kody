import { randomUUID } from 'node:crypto'
import { expect, test, waitForClientHydration } from '../playwright-utils.ts'

test('warm public shell navigation performs no server function reads', async ({
	page,
}) => {
	await page.goto('/pricing')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	const reads: string[] = []
	page.on('request', (request) => {
		if (request.url().includes('/_serverFn/')) reads.push(request.url())
	})
	await page.evaluate(() => window.history.pushState(null, '', '/faq'))
	await expect(page).toHaveURL(/\/faq$/)
	await expect(page.locator('main h1')).toContainText('Questions')
	await page.evaluate(() => window.history.pushState(null, '', '/pricing'))
	await expect(page.locator('main')).toContainText('Worker compute')
	await page.waitForLoadState('networkidle')
	expect(reads).toEqual([])
})

test('job presentation filters reuse the same payload but selected records remain data inputs', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `cache-${id}@example.com`,
		username: `cache-${id}`,
	})
	await login({ ...user, mode: 'login' })
	await page.goto('/account/jobs')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	const reads: string[] = []
	page.on('request', (request) => {
		if (
			request.url().includes('/_serverFn/') &&
			decodeURIComponent(request.url()).includes('/account/jobs')
		)
			reads.push(request.url())
	})
	await page.evaluate(() =>
		window.history.pushState(
			null,
			'',
			'/account/jobs?q=example&view=enabled&utm_source=test',
		),
	)
	await expect(page).toHaveURL(/q=example/)
	await expect(
		page.getByRole('heading', { name: 'Jobs', exact: true }),
	).toBeVisible()
	await page.waitForLoadState('networkidle')
	expect(reads).toEqual([])
	await page.evaluate(() =>
		window.history.pushState(
			null,
			'',
			'/account/jobs?selected=missing-test-job',
		),
	)
	await expect.poll(() => reads.length).toBe(1)
})

test('stale docs render cached content while their background read is held', async ({
	page,
}) => {
	await page.goto('/docs/secrets')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	await page.clock.install()
	await page.evaluate(() => window.history.pushState(null, '', '/pricing'))
	await expect(page.locator('main')).toContainText('Worker compute')
	await page.clock.fastForward(5 * 60_000 + 1_000)
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	let started!: () => void
	const reading = new Promise<void>((resolve) => {
		started = resolve
	})
	let completed = false
	await page.route('**/_serverFn/**', async (route) => {
		if (decodeURIComponent(route.request().url()).includes('"secrets"')) {
			started()
			await held
			await route.continue()
			completed = true
		} else await route.continue()
	})
	try {
		await page.evaluate(() =>
			window.history.pushState(null, '', '/docs/secrets?utm_source=revisit'),
		)
		await reading
		await expect(page.locator('main h1')).toContainText('Secrets')
		expect(completed).toBe(false)
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

test('an uncached docs destination keeps the previous page until its read completes', async ({
	page,
}) => {
	const errors: string[] = []
	page.on('pageerror', (error) => errors.push(error.message))
	page.on('console', (message) => {
		if (
			message.type() === 'error' &&
			message.text().startsWith('React client error:')
		)
			errors.push(message.text())
	})
	await page.goto('/pricing')
	await waitForClientHydration(page)
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
		await page.evaluate(() =>
			window.history.pushState(null, '', '/docs/secrets'),
		)
		await reading
		await expect(page.locator('main')).toContainText('Worker compute')
		release()
		await expect(page.locator('main h1')).toContainText('Secrets')
		expect(errors).toEqual([])
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

test('account attribution changes reuse the account payload', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `account-cache-${id}@example.com`,
		username: `account-cache-${id}`,
	})
	await login({ ...user, mode: 'login' })
	// Start outside account so its first client read identifies the endpoint.
	await page.goto('/pricing')
	await waitForClientHydration(page)
	const accountResponse = page.waitForResponse(async (response) => {
		if (!response.url().includes('/_serverFn/') || !response.ok()) return false
		const body = await response.text()
		return (
			body.includes('accountProfile') && body.includes('accountConnections')
		)
	})
	await page.evaluate(() => window.history.pushState(null, '', '/account'))
	const accountEndpoint = new URL((await accountResponse).url()).pathname
	await expect(page.getByLabel('Display name', { exact: true })).toBeVisible()
	const original = await page
		.getByLabel('Display name', { exact: true })
		.inputValue()
	await page.waitForLoadState('networkidle')
	const accountReads: string[] = []
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === accountEndpoint)
			accountReads.push(request.url())
	})
	for (const href of [
		'/account?utm_source=cache-test',
		'/account?utm_source=another&view=compact',
	]) {
		await page.evaluate(
			(href) => window.history.pushState(null, '', href),
			href,
		)
		await expect(page).toHaveURL((url) => url.pathname + url.search === href)
		await expect(page.getByLabel('Display name', { exact: true })).toHaveValue(
			original,
		)
		await page.waitForLoadState('networkidle')
	}
	// Protected session verification may still run. This checks only the
	// account data endpoint, whose input does not depend on these parameters.
	expect(accountReads).toEqual([])
})

test('profile presentation filters reuse data while limited searches have separate server inputs', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `profile-cache-${id}@example.com`,
		username: `profile-cache-${id}`,
	})
	await login({ ...user, mode: 'login' })
	const profileHref = `/@${user.username}`
	await page.goto(profileHref)
	await waitForClientHydration(page)
	await expect(page.getByTestId('profile-page')).toBeVisible()
	await page.waitForLoadState('networkidle')
	const profileReads: string[] = []
	page.on('request', (request) => {
		const url = decodeURIComponent(request.url())
		if (
			url.includes('/_serverFn/') &&
			url.includes('username') &&
			url.includes(user.username)
		)
			profileReads.push(url)
	})
	await page.evaluate(
		(href) => window.history.pushState(null, '', href),
		`${profileHref}?q=cachemissing${id}&view=compact&utm_source=test`,
	)
	await expect(
		page.getByRole('searchbox', { name: 'Search repositories' }),
	).toHaveValue(`cachemissing${id}`)
	await expect(page.getByTestId('profile-packages-empty')).toHaveText(
		'No repositories matched your search.',
	)
	await page.waitForLoadState('networkidle')
	expect(profileReads).toEqual([])

	await page.evaluate(
		(href) => window.history.pushState(null, '', href),
		`${profileHref}?visibility=private&view=grid&utm_source=another`,
	)
	await expect(
		page
			.getByTestId('profile-package-filter-visibility')
			.getByRole('link', { name: 'Private', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await expect(
		page.getByRole('searchbox', { name: 'Search repositories' }),
	).toHaveValue('')
	await page.waitForLoadState('networkidle')
	expect(profileReads).toEqual([])

	for (const [index, query] of ['cachefirst', 'cachesecond'].entries()) {
		await page.evaluate(
			(href) => window.history.pushState(null, '', href),
			`${profileHref}?limit=1&q=${query}&utm_source=test`,
		)
		await expect(
			page.getByRole('searchbox', { name: 'Search repositories' }),
		).toHaveValue(query)
		await page.waitForLoadState('networkidle')
		await expect.poll(() => profileReads.length).toBe(index + 1)
		expect(profileReads[index]).toContain(query)
		expect(profileReads[index]).toContain('limit')
		expect(profileReads[index]).not.toContain('utm_source')
	}
})

test('evicted initial docs keep the previous page while their new read is held', async ({
	page,
}) => {
	await page.goto('/docs/secrets')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	await page.clock.install()
	await page.evaluate(() => window.history.pushState(null, '', '/pricing'))
	await expect(page.locator('main')).toContainText('Worker compute')
	await page.clock.fastForward(31 * 60_000 + 1_000)
	let release!: () => void
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	let started!: () => void
	const reading = new Promise<void>((resolve) => {
		started = resolve
	})
	let completed = false
	await page.route('**/_serverFn/**', async (route) => {
		if (decodeURIComponent(route.request().url()).includes('"secrets"')) {
			started()
			await held
			await route.continue()
			completed = true
		} else await route.continue()
	})
	try {
		await page.evaluate(() =>
			window.history.pushState(null, '', '/docs/secrets?utm_source=revisit'),
		)
		await reading
		await expect(page.locator('main')).toContainText('Worker compute')
		expect(completed).toBe(false)
		release()
		await expect(page.locator('main h1')).toContainText('Secrets')
	} finally {
		release()
		await page.unrouteAll({ behavior: 'wait' })
	}
})

test('value search stays local while changing the selected record reads its own query', async ({
	page,
	seedE2eUser,
	login,
}) => {
	const id = randomUUID().slice(0, 8)
	const user = await seedE2eUser({
		email: `value-cache-${id}@example.com`,
		username: `value-cache-${id}`,
	})
	await login({ ...user, mode: 'login' })
	await page.goto('/account/values')
	await waitForClientHydration(page)
	await page.waitForLoadState('networkidle')
	const reads: Array<string> = []
	page.on('request', (request) => {
		const url = decodeURIComponent(request.url())
		if (url.includes('/_serverFn/') && url.includes('/account/values'))
			reads.push(url)
	})
	await page.evaluate(() =>
		window.history.pushState(
			null,
			'',
			'/account/values?q=example&utm_source=test',
		),
	)
	await expect(
		page.getByRole('heading', { name: 'Values', exact: true }),
	).toBeVisible()
	await page.waitForLoadState('networkidle')
	expect(reads).toEqual([])
	await page.evaluate(() =>
		window.history.pushState(
			null,
			'',
			'/account/values?selected=missing-value&q=example',
		),
	)
	await expect.poll(() => reads.length).toBe(1)
	expect(reads[0]).toContain('selected=missing-value')
})

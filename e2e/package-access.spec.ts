import { randomUUID } from 'node:crypto'
import { quoteSqlString } from '@kody-internal/shared/sql-literals.ts'
import { createPreviewPackage } from '../tools/control-kody/package-create.ts'
import { executeE2eD1Command } from './d1-utils.ts'
import {
	expect,
	test,
	waitForClientHydration,
	type APIRequestContext,
	type Page,
} from './playwright-utils.ts'

async function signIn(
	request: APIRequestContext,
	user: { email: string; password: string },
) {
	const response = await request.post('/auth', {
		data: { ...user, mode: 'login' },
	})
	expect(response.ok(), await response.text()).toBe(true)
}
async function expectPrivateContentDenied(
	page: Page,
	path: string,
	marker: string,
) {
	const response = await page.goto(path)
	expect(response?.status()).toBe(404)
	// Check serialized loader data as well as visible text.
	expect(await response!.text()).not.toContain(marker)
	await expect(page.getByTestId('package-owner-details')).toHaveCount(0)
	await expect(page.getByText(marker, { exact: true })).toHaveCount(0)
}

test('private package source and settings stay isolated across owner, shared guest, stranger, and anonymous navigation', async ({
	page,
	browser,
	baseURL,
	seedE2eUser,
	login,
}) => {
	test.setTimeout(240_000)
	const id = randomUUID().slice(0, 8)
	const owner = await seedE2eUser({
		email: `pkg-owner-${id}@example.com`,
		username: `pkg-owner-${id}`,
		admin: true,
	})
	const guest = await seedE2eUser({
		email: `pkg-guest-${id}@example.com`,
		username: `pkg-guest-${id}`,
	})
	const stranger = await seedE2eUser({
		email: `pkg-stranger-${id}@example.com`,
		username: `pkg-stranger-${id}`,
	})
	// Paid membership is a fixture prerequisite, not a billing operation.
	executeE2eD1Command(
		`UPDATE users SET plan='standard' WHERE email IN (${quoteSqlString(owner.email)},${quoteSqlString(guest.email)});`,
	)
	await login({ ...owner, mode: 'login' })
	for (const username of [owner.username, guest.username]) {
		const response = await page.request.post('/admin/feature-flags.json', {
			data: {
				action: 'set_user_override',
				key: 'package-share-grants',
				username,
				enabled: true,
			},
		})
		expect(response.ok(), await response.text()).toBe(true)
	}
	const guestContext = await browser.newContext({ baseURL })
	const strangerContext = await browser.newContext({ baseURL })
	const anonymousContext = await browser.newContext({ baseURL })
	const pageErrors: Array<{ viewer: string; message: string }> = []
	for (const [viewer, context] of Object.entries({
		owner: page.context(),
		guest: guestContext,
		stranger: strangerContext,
		anonymous: anonymousContext,
	})) {
		context.on('weberror', (error) =>
			pageErrors.push({ viewer, message: error.error().message }),
		)
	}

	let packageId: string | undefined
	let packageName: string | undefined
	try {
		const marker = `Private source marker ${id}, only the owner and accepted guest may read this.`
		const cookieHeader = (await page.context().cookies(baseURL))
			.map((cookie) => `${cookie.name}=${cookie.value}`)
			.join('; ')
		const created = await createPreviewPackage({
			origin: baseURL!,
			email: owner.email,
			password: owner.password,
			kodyId: `parity-${id}`,
			description: marker,
			headAhead: false,
			cookieHeader,
		})
		packageId = created.packageId
		packageName = created.name
		const path = created.packagePagePath
		const apiPath = `/profiles/${owner.username}/packages/${created.kodyId}`
		await page.goto(path)
		await waitForClientHydration(page)
		await expect(page.getByText(marker, { exact: true }).first()).toBeVisible()
		await page.evaluate(() => {
			document.documentElement.dataset.packageNavigation = 'same-document'
		})
		await page.getByRole('link', { name: 'Files', exact: true }).click()
		await expect(page.getByTestId('package-files')).toBeVisible()
		await page
			.getByRole('navigation', { name: 'Files', exact: true })
			.getByRole('link', { name: 'README.md', exact: true })
			.click()
		await expect(page.getByTestId('package-files-markdown')).toContainText(
			marker,
		)
		await page.getByRole('link', { name: 'Settings', exact: true }).click()
		await expect(page.getByTestId('package-owner-details')).toBeVisible()
		await expect(page.locator('html')).toHaveAttribute(
			'data-package-navigation',
			'same-document',
		)
		const lock = page.getByTestId('account-package-lock-toggle')
		await expect(lock).toHaveAttribute('data-locked', 'false')
		await lock.click()
		await expect(lock).toHaveAttribute('data-locked', 'true')
		await page.reload()
		await waitForClientHydration(page)
		await expect(lock).toHaveAttribute('data-locked', 'true')
		await lock.click()
		await expect(lock).toHaveAttribute('data-locked', 'false')

		const guestPage = await guestContext.newPage()
		const strangerPage = await strangerContext.newPage()
		const anonymousPage = await anonymousContext.newPage()
		await signIn(guestContext.request, guest)
		await signIn(strangerContext.request, stranger)
		for (const denied of [strangerPage, anonymousPage]) {
			await expectPrivateContentDenied(denied, path, marker)
			await expectPrivateContentDenied(denied, `${path}/settings`, marker)
			const source = await denied.request.get(
				`${apiPath}/files.json?path=README.md`,
			)
			expect(source.status()).toBe(404)
			expect(await source.text()).not.toContain(marker)
		}
		const share = page.getByTestId('package-share-settings')
		await share.getByLabel('Username', { exact: true }).fill(guest.username)
		await share
			.getByRole('button', { name: 'Send invite', exact: true })
			.click()
		await expect(
			share.getByText(`@${guest.username}`, { exact: true }),
		).toBeVisible()
		await guestPage.goto(path)
		await waitForClientHydration(guestPage)
		await expect(
			guestPage.getByTestId('package-share-accept-banner'),
		).toBeVisible()
		await guestPage.getByTestId('package-share-accept-follow').click()
		await expect(
			guestPage.getByTestId('package-share-accepted-status'),
		).toBeVisible()
		await expect(
			guestPage.getByText(marker, { exact: true }).first(),
		).toBeVisible()
		await expect(
			guestPage.getByRole('link', { name: 'Settings', exact: true }),
		).toHaveCount(0)
		await guestPage.getByRole('link', { name: 'Files', exact: true }).click()
		await guestPage
			.getByRole('navigation', { name: 'Files', exact: true })
			.getByRole('link', { name: 'README.md', exact: true })
			.click()
		await expect(guestPage.getByTestId('package-files-markdown')).toContainText(
			marker,
		)
		// Shared metadata is insufficient for owner settings, even on a direct URL.
		await expectPrivateContentDenied(guestPage, `${path}/settings`, marker)
		const guestWrite = await guestPage.request.post('/account/packages.json', {
			data: { action: 'lock', packageId },
		})
		expect(guestWrite.ok()).toBe(false)

		await share.getByRole('button', { name: 'Revoke', exact: true }).click()
		await expect(
			share.getByText(`@${guest.username}`, { exact: true }),
		).toHaveCount(0)
		await expectPrivateContentDenied(guestPage, path, marker)
		const revokedSource = await guestPage.request.get(
			`${apiPath}/files.json?path=README.md`,
		)
		expect(revokedSource.status()).toBe(404)
		expect(await revokedSource.text()).not.toContain(marker)
		const ownerSource = await page.request.get(
			`${apiPath}/files.json?path=README.md`,
		)
		expect(ownerSource.ok()).toBe(true)
		expect(await ownerSource.text()).toContain(marker)
	} finally {
		if (packageId)
			await page.request.post('/account/packages.json', {
				data: { action: 'delete', packageId, confirmName: packageName },
			})
		await Promise.all([
			guestContext.close(),
			strangerContext.close(),
			anonymousContext.close(),
		])
	}
	expect(pageErrors).toEqual([])
})

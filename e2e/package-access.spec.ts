import { randomUUID } from 'node:crypto'
import { quoteSqlString } from '@kody-internal/shared/sql-literals.ts'
import { createPreviewPackage } from '../tools/control-kody/package-create.ts'
import { executeE2eD1Command } from './d1-utils.ts'
import {
	expect,
	request as playwrightRequest,
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

test('private package source and settings stay isolated across owner, granted guest, stranger, and anonymous navigation', async ({
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
		`UPDATE orgs SET plan='standard' WHERE slug IN (${quoteSqlString(owner.username)},${quoteSqlString(guest.username)});`,
	)
	await login({ ...owner, mode: 'login' })
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
		// Personal organizations intentionally have no grant-management UI.
		// Seed the current Use grant contract, including its access-cache epoch.
		executeE2eD1Command(`
			INSERT INTO grants (
				id, org_id, resource_type, resource_id, subject_type, subject_id,
				preset, created_by_user_id, created_at, updated_at
			)
			SELECT ${quoteSqlString(`access-${id}`)}, orgs.id, 'package',
				${quoteSqlString(packageId)}, 'user', guest.stable_user_id, 'use', owner.stable_user_id,
				CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
			FROM orgs JOIN users owner ON owner.username = orgs.slug
			JOIN users guest ON guest.username = ${quoteSqlString(guest.username)}
			WHERE orgs.slug = ${quoteSqlString(owner.username)};
			INSERT INTO grant_permissions (grant_id, permission) VALUES
				(${quoteSqlString(`access-${id}`)}, 'package:read'),
				(${quoteSqlString(`access-${id}`)}, 'package:execute');
			UPDATE orgs SET access_epoch = access_epoch + 1
			WHERE slug = ${quoteSqlString(owner.username)};
		`)
		await guestPage.goto(path)
		await waitForClientHydration(guestPage)
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

		executeE2eD1Command(`
			UPDATE grants SET deleted_at = CURRENT_TIMESTAMP,
				updated_at = CURRENT_TIMESTAMP WHERE id = ${quoteSqlString(`access-${id}`)};
			UPDATE orgs SET access_epoch = access_epoch + 1
			WHERE slug = ${quoteSqlString(owner.username)};
		`)
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
		// An independent, bounded context can clean up even when the test's
		// request fixture has timed out. Cleanup must not hide the first failure.
		try {
			if (packageId) {
				const cleanup = await playwrightRequest.newContext({
					baseURL,
					storageState: await page.context().storageState(),
					timeout: 10_000,
				})
				try {
					await cleanup.post('/account/packages.json', {
						data: { action: 'delete', packageId, confirmName: packageName },
					})
				} finally {
					await cleanup.dispose()
				}
			}
		} catch (error) {
			console.warn('Package access fixture cleanup failed:', error)
		} finally {
			await Promise.allSettled([
				guestContext.close(),
				strangerContext.close(),
				anonymousContext.close(),
			])
		}
	}
	expect(pageErrors).toEqual([])
})

import {
	expect,
	test,
	type Page,
	waitForClientHydration,
} from './playwright-utils.ts'

import { waitForDestinationRead } from './server-function-requests.ts'

async function openSwitcher(page: Page) {
	const trigger = page.getByTestId('org-switcher')
	const panel = page.getByTestId('org-switcher-panel')
	await trigger.click()
	await expect(panel).toBeVisible()
	await expect(trigger).toHaveAttribute('aria-expanded', 'true')
	await expect
		.poll(() => panel.evaluate((node) => getComputedStyle(node).opacity))
		.toBe('1')
	return { trigger, panel }
}

test('org switcher opens under its trigger, lists orgs, and closes like a menu', async ({
	page,
	seedE2eUser,
	login,
}) => {
	test.setTimeout(process.env.CI ? 90_000 : 60_000)
	const runId = Date.now()
	const user = await seedE2eUser({
		email: `org-switcher-${runId}@example.com`,
		username: `org-switcher-${runId}`,
		password: 'org-switcher-password',
	})
	await login({ email: user.email, password: user.password, mode: 'login' })

	await page.goto('/account/security')
	await waitForClientHydration(page)
	const accountRail = page.getByRole('navigation', { name: 'Account sections' })
	await expect(
		accountRail.getByRole('link', { name: 'Security', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await expect(
		accountRail.getByRole('link', { name: 'Profile', exact: true }),
	).not.toHaveAttribute('aria-current')

	// Create a second organization through the form; the handle follows the name.
	await page.setViewportSize({ width: 1440, height: 900 })
	await page.goto('/account/organizations/new')
	await waitForClientHydration(page)
	await page.getByLabel('Name').fill(`Pinned ${runId}`)
	await expect(page.getByLabel('Handle')).toHaveValue(`pinned-${runId}`)
	await page
		.getByRole('button', { name: 'Create organization', exact: true })
		.click()
	await expect(page.getByTestId('create-organization-confirm')).toContainText(
		`kody.codes/@pinned-${runId}`,
	)
	await page.getByRole('button', { name: 'Yes, create organization' }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}$`))
	await expect(
		page.getByRole('heading', { level: 1, name: `Pinned ${runId}` }),
	).toBeVisible()
	await expect(page.getByTestId('org-home')).toBeVisible()
	await waitForClientHydration(page)

	const wide = await openSwitcher(page)
	await expect(
		wide.panel.getByTestId(`org-switcher-pinned-${runId}`),
	).toHaveAttribute('aria-current', 'page')
	await expect(
		wide.panel.getByTestId(`org-switcher-${user.username}`),
	).not.toHaveAttribute('aria-current')
	await expect(
		wide.panel.getByTestId(`org-switcher-pinned-${runId}`),
	).toHaveAttribute('data-selected', '')
	await expect(
		wide.panel.getByTestId(`org-switcher-${user.username}`),
	).not.toHaveAttribute('data-selected')
	await expect(wide.panel.getByTestId('org-switcher-create')).toBeVisible()
	await expect(page.getByTestId('org-home-nav-workspace')).toHaveAttribute(
		'href',
		`/@pinned-${runId}/-/repositories`,
	)
	// No invites waiting, so no Invites row. The person's own links live in
	// the account menu, not the org switcher.
	await expect(wide.panel.getByTestId('org-switcher-invites')).toHaveCount(0)
	await expect(wide.panel.getByTestId('org-switcher-logout')).toHaveCount(0)
	await page.keyboard.press('Escape')
	await expect(wide.panel).toBeHidden()
	const accountMenu = page.getByTestId('account-menu')
	await accountMenu.click()
	const accountPanel = page.getByTestId('account-menu-panel')
	await expect(accountPanel).toBeVisible()
	const accountGroup = accountPanel.getByRole('group', { name: 'Your account' })
	await expect(
		accountGroup.getByRole('link', { name: 'Your profile' }),
	).toHaveAttribute('href', `/@${user.username}`)
	await expect(
		accountGroup.getByRole('link', { name: 'Account settings' }),
	).toHaveAttribute('href', '/account')
	await expect(
		accountGroup.getByRole('link', { name: 'Usage & credits' }),
	).toHaveAttribute('href', '/account/usage')
	await expect(
		accountGroup.getByRole('button', { name: 'Log out' }),
	).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(accountPanel).toBeHidden()
	await openSwitcher(page)

	// Arrow keys walk the rows; Escape closes and returns focus to the trigger.
	await wide.trigger.focus()
	await page.keyboard.press('ArrowDown')
	await expect(
		wide.panel.getByTestId(`org-switcher-${user.username}`),
	).toBeFocused()
	await page.keyboard.press('End')
	await expect(wide.panel.getByTestId('org-switcher-create')).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(wide.panel).toBeHidden()
	await expect(wide.trigger).toBeFocused()
	await expect(wide.trigger).toHaveAttribute('aria-expanded', 'false')

	// A narrower desktop still opens the menu; a click outside closes it.
	await page.setViewportSize({ width: 860, height: 800 })
	const narrow = await openSwitcher(page)
	await page.mouse.click(20, 700)
	await expect(narrow.panel).toBeHidden()

	// Team settings chrome must name the URL org (not the personal org) next
	// to Delete organization.
	await page.setViewportSize({ width: 1440, height: 900 })
	await page.goto(`/@pinned-${runId}/-/settings`)
	await waitForClientHydration(page)
	// Team workspace rail matches the personal shape: same resource sections
	// (MCP servers, Integrations, …) plus Members, Settings, and Billing.
	const teamRail = page.getByRole('navigation', { name: 'Workspace sections' })
	for (const label of [
		'Overview',
		'Repositories',
		'Jobs',
		'Webhooks',
		'Secrets',
		'Integrations',
		'MCP servers',
		'Secret providers',
		'Agents',
		'Memories',
		'Email',
		'Activity',
		'Members',
		'Settings',
		'Billing',
	] as const) {
		await expect(
			teamRail.getByRole('link', { name: label, exact: true }),
		).toBeVisible()
	}
	await expect(
		teamRail.getByRole('link', { name: 'Overview', exact: true }),
	).toHaveAttribute('href', `/@pinned-${runId}`)
	await expect(
		teamRail.getByRole('link', { name: 'MCP servers', exact: true }),
	).toHaveAttribute('href', `/@pinned-${runId}/-/mcp-servers`)
	await expect(page.getByTestId('org-switcher')).toHaveAccessibleName(
		`@pinned-${runId}: switch organization`,
	)
	await expect(
		page.getByLabel('Workspace sections').getByText(`@pinned-${runId}`),
	).toBeVisible()
	await expect(page.getByTestId('delete-org')).toBeVisible()

	// Teams, Collaborators, and Grants are tabs on Members.
	await teamRail.getByRole('link', { name: 'Members', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/members$`))
	const memberTabs = page.getByRole('navigation', { name: 'Members pages' })
	for (const label of ['Members', 'Teams', 'Collaborators', 'Grants']) {
		await expect(
			memberTabs.getByRole('link', { name: label, exact: true }),
		).toBeVisible()
	}
	await memberTabs.getByRole('link', { name: 'Grants', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/grants$`))
	await expect(
		teamRail.getByRole('link', { name: 'Members', exact: true }),
	).toHaveAttribute('aria-current', 'page')

	// Team orgs own their secrets, jobs, agents, and repositories, so the
	// rail opens each of them on the team org.
	const rail = page.getByRole('navigation', { name: 'Workspace sections' })
	await rail.getByRole('link', { name: 'Secrets', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/secrets$`))
	await expect(
		page.getByRole('heading', { level: 1, name: 'Secrets' }),
	).toBeVisible()
	await expect(
		rail.getByRole('link', { name: 'Secrets', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await rail.getByRole('link', { name: 'Jobs', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/jobs$`))
	await expect(
		page.getByRole('heading', { level: 1, name: 'Jobs' }),
	).toBeVisible()
	await expect(
		rail.getByRole('link', { name: 'Jobs', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await expect(
		rail.getByRole('link', { name: 'Settings', exact: true }),
	).not.toHaveAttribute('aria-current', 'page')
	await expect(
		rail.getByRole('link', { name: 'Overview', exact: true }),
	).not.toHaveAttribute('aria-current')

	// Agents lists only agents approved for the team org (none yet).
	await rail.getByRole('link', { name: 'Agents', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/agents$`))
	await expect(
		page.getByRole('region', { name: 'Connected agents' }),
	).toBeVisible()
	await expect(
		rail.getByRole('link', { name: 'Agents', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await expect(page.getByTestId('not-found-page')).toHaveCount(0)

	// Repositories list what the team org owns (nothing yet).
	await rail.getByRole('link', { name: 'Repositories', exact: true }).click()
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/repositories$`))
	await expect(page.getByTestId('workspace-repositories')).toBeVisible()
	await expect(page.getByTestId('profile-packages-empty')).toBeVisible()
	// Searching inside a workspace must retain its authorization scope.
	await page.getByTestId('profile-repository-search').fill('workspace-search')
	await expect(page).toHaveURL(
		new RegExp(`/@pinned-${runId}/-/repositories\\?q=workspace-search$`),
	)
	await expect(page.getByTestId('workspace-repositories')).toBeVisible()
	await page.getByTestId('profile-repository-search').fill('')
	await expect(page).toHaveURL(new RegExp(`/@pinned-${runId}/-/repositories$`))
	const filterLinks = page.getByTestId('profile-package-filters').locator('a')
	expect(await filterLinks.count()).toBeGreaterThan(0)
	for (const href of await filterLinks.evaluateAll((links) =>
		links.map((link) => link.getAttribute('href')),
	)) {
		expect(href).toMatch(
			new RegExp(`^/@pinned-${runId}/-/repositories(?:\\?|$)`),
		)
	}

	await expect(
		rail.getByRole('link', { name: 'Repositories', exact: true }),
	).toHaveAttribute('aria-current', 'page')
	await expect(page.getByTestId('not-found-page')).toHaveCount(0)

	// A full load of each team page is a 200, not the old 404.
	for (const section of ['agents', 'repositories']) {
		const response = await page.goto(`/@pinned-${runId}/-/${section}`)
		expect(response?.status(), section).toBe(200)
	}
	const legacyConnections = await page.goto(
		`/@pinned-${runId}/-/connections/new?q=legacy`,
	)
	expect(legacyConnections?.status(), 'legacy /-/connections').toBe(200)
	await expect(page).toHaveURL(
		new RegExp(`/@pinned-${runId}/-/agents/new\\?q=legacy$`),
	)
	const legacy = await page.goto(`/@pinned-${runId}/-/packages?q=legacy`)
	expect(legacy?.status(), 'legacy /-/packages').toBe(200)
	await expect(page).toHaveURL(
		new RegExp(`/@pinned-${runId}/-/repositories\\?q=legacy$`),
	)
})

test('switching orgs from Secrets loads the destination org, not the one you left', async ({
	page,
	seedE2eUser,
	login,
}) => {
	test.setTimeout(process.env.CI ? 90_000 : 60_000)
	const runId = Date.now()
	const user = await seedE2eUser({
		email: `org-switch-secrets-${runId}@example.com`,
		username: `org-switch-secrets-${runId}`,
		password: 'org-switch-secrets-password',
	})
	await login({ email: user.email, password: user.password, mode: 'login' })
	const saved = await page.request.post('/account/secrets.json', {
		data: {
			action: 'save',
			name: 'personalOnlySecret',
			scope: 'user',
			value: 'personal-secret-value',
			allowedHosts: [],
			allowedPackages: [],
		},
		headers: { 'Content-Type': 'application/json' },
	})
	expect(saved.ok()).toBe(true)

	await page.setViewportSize({ width: 1440, height: 900 })
	await page.goto('/account/organizations/new')
	await waitForClientHydration(page)
	await page.getByLabel('Name').fill(`Switch ${runId}`)
	await expect(page.getByLabel('Handle')).toHaveValue(`switch-${runId}`)
	await page
		.getByRole('button', { name: 'Create organization', exact: true })
		.click()
	await page.getByRole('button', { name: 'Yes, create organization' }).click()
	await expect(page).toHaveURL(new RegExp(`/@switch-${runId}$`))

	await page.goto(`/@${user.username}/-/secrets`)
	await waitForClientHydration(page)
	await expect(page.getByText('personalOnlySecret')).toBeVisible()

	// The destination travels as server-function input while the current URL
	// still names the personal org. Verify that transport and the returned data.
	const teamLoad = waitForDestinationRead(page, `/@switch-${runId}/-/secrets`)
	const { panel } = await openSwitcher(page)
	await panel.getByTestId(`org-switcher-switch-${runId}`).click()
	await expect(page).toHaveURL(new RegExp(`/@switch-${runId}/-/secrets$`))
	const teamResponse = await teamLoad
	expect(teamResponse.ok()).toBe(true)
	expect(await teamResponse.text()).not.toContain('personalOnlySecret')
	await expect(
		page.getByRole('heading', { level: 1, name: 'Secrets' }),
	).toBeVisible()
	await expect(
		page.getByText('No secrets yet.', { exact: false }),
	).toBeVisible()
	await expect(page.getByText('personalOnlySecret')).toHaveCount(0)
	const back = await openSwitcher(page)
	await back.panel.getByTestId(`org-switcher-${user.username}`).click()
	await expect(page).toHaveURL(new RegExp(`/@${user.username}/-/secrets$`))
	await expect(page.getByText('personalOnlySecret')).toBeVisible()
	await page.goBack()
	await expect(page).toHaveURL(new RegExp(`/@switch-${runId}/-/secrets$`))
	await expect(page.getByText('personalOnlySecret')).toHaveCount(0)
	await expect(
		page.getByText('No secrets yet.', { exact: false }),
	).toBeVisible()
})

test('the switcher keeps each org section and reads the destination org through Start', async ({
	page,
	seedE2eUser,
	login,
}) => {
	test.setTimeout(process.env.CI ? 120_000 : 90_000)
	const runId = Date.now()
	const user = await seedE2eUser({
		email: `org-sections-${runId}@example.com`,
		username: `org-sections-${runId}`,
		password: 'org-switch-sections-password',
	})
	await login({ email: user.email, password: user.password, mode: 'login' })
	await page.setViewportSize({ width: 1440, height: 900 })
	await page.goto('/account/organizations/new')
	await waitForClientHydration(page)
	await page.getByLabel('Name').fill(`Sections ${runId}`)
	await expect(page.getByLabel('Handle')).toHaveValue(`sections-${runId}`)
	await page
		.getByRole('button', { name: 'Create organization', exact: true })
		.click()
	await page.getByRole('button', { name: 'Yes, create organization' }).click()
	await expect(page).toHaveURL(new RegExp(`/@sections-${runId}$`))

	const personalServerName = `personal-mcp-${runId}`
	const teamServerName = `team-mcp-${runId}`
	for (const [slug, name] of [
		[user.username, personalServerName],
		[`sections-${runId}`, teamServerName],
	]) {
		const added = await page.request.post('/account/mcp-servers.json', {
			data: { action: 'add', name, url: 'http://127.0.0.1:9/mcp' },
			headers: {
				'Content-Type': 'application/json',
				Referer: new URL(`/@${slug}/-/mcp-servers`, page.url()).href,
			},
		})
		expect(added.ok(), await added.text()).toBe(true)
	}

	// The switcher keeps the section. The router runs the loader before it
	// commits the URL, so the server-function input must name the team page.
	for (const section of [
		'memories',
		'workflows',
		'waiting',
		'webhooks',
		'mcp-servers',
		'values',
	]) {
		await page.goto(`/@${user.username}/-/${section}`)
		await waitForClientHydration(page)
		const destination = `/@sections-${runId}/-/${section}`
		const teamLoad = waitForDestinationRead(page, destination)
		const { panel } = await openSwitcher(page)
		const teamRow = panel.getByTestId(`org-switcher-sections-${runId}`)
		await expect(teamRow).toHaveAttribute('href', destination)
		await teamRow.click()
		await expect(page).toHaveURL(new RegExp(`${destination}$`))
		const response = await teamLoad
		expect(response.ok(), section).toBe(true)
		const body = await response.text()
		await expect(page.getByTestId('not-found-page')).toHaveCount(0)
		const labels: Record<string, string> = {
			memories: 'Memories',
			workflows: 'Workflows',
			waiting: 'Waiting',
			webhooks: 'Webhooks',
			'mcp-servers': 'MCP servers',
			values: 'Values',
		}
		await expect(
			page.getByRole('heading', {
				level: 1,
				name: labels[section],
				exact: true,
			}),
		).toBeVisible()
		const sectionLink = page
			.getByRole('navigation', { name: 'Workspace sections' })
			.getByRole('link', { name: labels[section], exact: true })
		if (section === 'values') {
			// The shared upstream rail intentionally omits the retiring Values
			// primitive. Its existing URL still keeps org context and loads above.
			await expect(sectionLink).toHaveCount(0)
		} else if (section === 'workflows' || section === 'waiting') {
			await expect(sectionLink).toHaveCount(0)
			await expect(
				page
					.getByRole('navigation', { name: 'Workspace sections' })
					.getByRole('link', { name: 'Activity', exact: true }),
			).toHaveAttribute('aria-current', 'page')
			await expect(
				page
					.getByRole('navigation', { name: 'Activity pages' })
					.getByRole('link', { name: labels[section], exact: true }),
			).toHaveAttribute('aria-current', 'page')
		} else {
			await expect(sectionLink).toHaveAttribute('aria-current', 'page')
		}
		if (section === 'mcp-servers') {
			expect(body).toContain(teamServerName)
			expect(body).not.toContain(personalServerName)
			await expect(
				page.getByText(teamServerName, { exact: true }),
			).toBeVisible()
			await expect(
				page.getByText(personalServerName, { exact: true }),
			).toHaveCount(0)
		}
	}
})

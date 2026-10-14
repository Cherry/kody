import { createElement } from 'react'
import { expect, test } from 'vitest'
import { renderStartPage } from './test-support/render-start-page.ts'
import { AccountPageHeader } from './pages/account-management-components.tsx'

async function header(path: string) {
	return renderStartPage(
		createElement(AccountPageHeader, {
			title: 'Test',
			description: '',
			currentHref: path,
		}),
		path,
	)
}

test('workspace rail groups Activity siblings as native navigation tabs', async () => {
	const html = await header('/@acme/-/workflows')
	expect(html).toContain('aria-label="Activity pages"')
	expect(html).toMatch(
		/<a(?=[^>]*href="\/@acme\/-\/workflows")(?=[^>]*aria-current="page")[^>]*>/,
	)
	expect(html).toContain('href="/@acme/-/waiting"')
	expect(html).toContain('href="/@acme/-/agents"')
	expect(html).not.toContain('href="/account/usage"')
})

test('workspace settings do not duplicate Activity tabs in the rail', async () => {
	const html = await header('/@acme/-/settings')
	expect(html).toContain('href="/@acme/-/activity"')
	expect(html).toContain('href="/@acme/-/agents"')
	expect(html).not.toContain('href="/@acme/-/workflows"')
	expect(html).not.toContain('href="/@acme/-/waiting"')
	expect(html).not.toContain('href="/account/usage"')
})

test('personal account rail keeps account chrome without legacy usage links', async () => {
	const html = await header('/account')
	expect(html).toContain('href="/account/security"')
	expect(html).toContain('href="/account/organizations"')
	expect(html).not.toContain('href="/account/usage"')
	expect(html).not.toContain('Usage &amp; credits')
	expect(html).not.toContain('account-section-tabs')
})

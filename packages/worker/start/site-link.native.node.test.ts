import { createElement } from 'react'
import { expect, test } from 'vitest'
import { SiteLink } from './components/site-link.tsx'
import { renderStartPage } from './test-support/render-start-page.ts'

test('exact active links preserve explicit current semantics and default to page', async () => {
	for (const current of ['step', 'true', false, undefined] as const) {
		const html = await renderStartPage(
			createElement(
				SiteLink,
				{ href: '/onboarding/step-2', 'aria-current': current },
				'Step',
			),
			'/onboarding/step-2',
		)
		expect(html).toContain(`aria-current="${current ?? 'page'}"`)
		expect(html).toContain('data-status="active"')
	}
})

test('section links retain caller current state for descendants without marking ordinary parent links active', async () => {
	const current = await renderStartPage(
		createElement(SiteLink, { href: '/docs', 'aria-current': 'page' }, 'Docs'),
		'/docs/connect',
	)
	expect(current).toContain('aria-current="page"')
	const ordinary = await renderStartPage(
		createElement(SiteLink, { href: '/docs' }, 'Docs'),
		'/docs/connect',
	)
	expect(ordinary).not.toContain('aria-current=')
	expect(ordinary).not.toContain('data-status="active"')
})

test('external links remain plain anchors with their supplied accessibility state', async () => {
	const html = await renderStartPage(
		createElement(
			SiteLink,
			{ href: 'https://example.com/docs', 'aria-current': 'location' },
			'External docs',
		),
	)
	expect(html).toContain('href="https://example.com/docs"')
	expect(html).toContain('aria-current="location"')
	expect(html).not.toContain('data-status=')
	expect(html).not.toMatch(/\scurrent=/)
})

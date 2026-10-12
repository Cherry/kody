import { jsx } from 'react/jsx-runtime'
import { renderStartPage as renderToString } from '../test-support/render-start-page.ts'
import { expect, test } from 'vitest'
import { InternalErrorPage } from '../components/internal-error-page.tsx'
import {
	internalErrorPageCopy,
	internalErrorPageHeading,
	internalErrorPageImageSrc,
} from '#universal/internal-error-page.ts'

test('internal-error page shows the zapped illustration and recovery destinations', async () => {
	const html = await renderToString(jsx(InternalErrorPage, {}), '/account')

	expect(html).toContain('data-testid="internal-error-page"')
	expect(html).toContain(internalErrorPageHeading)
	expect(html).toContain(internalErrorPageCopy)
	expect(html).toContain(`src="${internalErrorPageImageSrc}"`)
	expect(html).toContain('href="/account"')
	expect(html).toContain('href="/"')
	expect(html).toContain('Try again')
	expect(html).toContain('Go home')
})

test('internal-error Try again stays same-origin for protocol-relative URLs', async () => {
	const html = await renderToString(
		jsx(InternalErrorPage, {}),
		'//evil.example',
	)

	expect(html).toContain('Try again')
	expect(html).not.toContain('href="//evil.example"')
	expect(html).toContain('href="/"')
})

import { jsx } from 'react/jsx-runtime'
import { renderStartPage as renderToString } from '../../../test-support/render-start-page.ts'
import { expect, test } from 'vitest'
import { SecretsFeature } from '../../../pages/features/secrets.tsx'

test('secrets feature page links to onboarding', async () => {
	const html = await renderToString(jsx(SecretsFeature, {}))

	expect(html).toContain('href="/onboarding"')
	expect(html).toContain('Connect your agent')
	expect(html.match(/href="\/onboarding"/g)?.length).toBeGreaterThanOrEqual(2)
})

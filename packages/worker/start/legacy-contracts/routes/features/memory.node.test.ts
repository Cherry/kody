import { jsx } from 'react/jsx-runtime'
import { renderStartPage as renderToString } from '../../../test-support/render-start-page.ts'
import { expect, test } from 'vitest'
import { MemoryFeature } from '../../../pages/features/memory.tsx'

test('memory hero and update scene share one writing preference', async () => {
	const html = await renderToString(jsx(MemoryFeature, {}))

	expect(html).toContain('id="ms-hero-note"')
	expect(html).toContain('id="ms-updated-note"')
	expect(html).toContain('Lead with the decision. Keep updates short.')
	expect(html).toContain('id="ms-update"')
	expect(html).toContain('Make updates more detailed')
})

import { createElement } from 'react'
import { expect, test } from 'vitest'
import { AccountValuesPage } from './pages/account-values.tsx'
import { AccountMemoriesPage } from './pages/account-memories.tsx'
import { renderStartPage } from './test-support/render-start-page.ts'

// Render with a deliberately different link location. Selection belongs to the
// retained route's decoded params, not a second parser in the page component.
test('values uses the provided detail identity instead of reparsing link location', async () => {
	const html = await renderStartPage(
		createElement(AccountValuesPage, {
			currentHref: '/@team/-/values?q=needle',
			selection: { kind: 'detail', valueId: 'missing.id' },
			payload: {
				ok: true,
				values: [],
				selectedValue: null,
				selectedValueId: null,
			},
		}),
		'/@team/-/values?q=needle',
	)
	expect(html).toContain('Value not found')
	expect(html).toContain('value="needle"')
})

test('memories uses the provided detail identity instead of reparsing link location', async () => {
	const html = await renderStartPage(
		createElement(AccountMemoriesPage, {
			currentHref: '/@team/-/memories?q=needle',
			selectedId: 'missing.id',
			payload: {
				ok: true,
				email: 'owner@example.com',
				username: 'owner',
				memories: [],
				selectedMemory: null,
				query: 'needle',
				includeDeleted: false,
				legacyReadOnly: false,
			},
		}),
		'/@team/-/memories?q=needle',
	)
	expect(html).toContain('Memory not found')
	expect(html).toContain('value="needle"')
})

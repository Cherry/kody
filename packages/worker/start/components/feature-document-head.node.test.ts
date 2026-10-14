import { expect, test } from 'vitest'
import {
	absolutizeDocumentHead,
	resolveDocumentHead,
	NOT_FOUND_DOCUMENT_TITLE,
} from '#universal/document-head.ts'

const featureHeads = {
	'': 'features',
	'/memory': 'featureMemory',
	'/secrets': 'featureSecrets',
	'/packages': 'featurePackages',
	'/triggers': 'featureTriggers',
	'/integrations': 'featureIntegrations',
	'/apps': 'featureApps',
} as const

test.each([
	'',
	'/memory',
	'/secrets',
	'/packages',
	'/triggers',
	'/integrations',
	'/apps',
])('feature page %s has canonical metadata and its stylesheet', (suffix) => {
	const path = `/features${suffix}`
	const head = absolutizeDocumentHead(
		resolveDocumentHead(
			featureHeads[suffix as keyof typeof featureHeads],
			path,
		),
		'https://kody.codes',
	)
	expect(head.title).not.toBe(NOT_FOUND_DOCUMENT_TITLE)
	expect(head.description).toBeTruthy()
	expect(head.canonicalUrl).toBe(`https://kody.codes${path}`)
	expect(head.og?.imageUrl).toBe(
		`https://kody.codes/og/${suffix ? `feature-${suffix.slice(1)}` : 'features'}.png`,
	)
	expect(head.links).toContainEqual({
		rel: 'stylesheet',
		href: '/feature-pages.css',
	})
	const sceneLinks = (head.links ?? []).filter((link) =>
		link.href.startsWith('/feature-scenes/'),
	)
	expect(sceneLinks).toEqual(
		suffix ? [{ rel: 'stylesheet', href: `/feature-scenes${suffix}.css` }] : [],
	)
})

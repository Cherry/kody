import { expect, test } from 'vitest'
import { isNegotiatedDocumentPath } from './document-negotiation.ts'

test('only document routes with Markdown variants vary by Accept', () => {
	for (const pathname of [
		'/',
		'/docs',
		'/docs/',
		'/docs/connect',
		'/docs/secrets',
		'/docs/secrets/',
		'/blog/hello',
	]) {
		expect(isNegotiatedDocumentPath(pathname)).toBe(true)
	}
	for (const pathname of [
		'/pricing',
		'/blog',
		'/blog/',
		'/docs.json',
		'/docs/secrets.json',
		'/docs/secrets.md',
		'/docs/connect/github',
		'/blog/hello/image',
		'/_serverFn/example',
	]) {
		expect(isNegotiatedDocumentPath(pathname)).toBe(false)
	}
})

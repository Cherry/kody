import { expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({ url: 'https://kody.test/' }))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => new Request(state.url),
}))
import { isOrgDocumentRequest } from './org-document-request.ts'

test('org document renders may remember the org, server-function reads never do', () => {
	state.url = 'https://kody.test/@acme/-/jobs'
	expect(isOrgDocumentRequest()).toBe(true)
	state.url = 'https://kody.test/@acme'
	expect(isOrgDocumentRequest()).toBe(true)
	state.url = 'https://kody.test/_serverFn/read?href=%2F%40other%2F-%2Fjobs'
	expect(isOrgDocumentRequest()).toBe(false)
	state.url = 'https://kody.test/account'
	expect(isOrgDocumentRequest()).toBe(false)
})

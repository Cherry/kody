import { expect, test, vi } from 'vitest'
vi.mock('#start/server/credentials', () => ({ loadCredentialsPage: vi.fn() }))
import {
	credentialsPageQuery,
	validateCredentialSearch,
} from './credentials-query.ts'

test('presentation filters share a cache entry but actors, orgs and selections do not', () => {
	const key = credentialsPageQuery('actor', '/@acme/-/credentials').queryKey
	expect(
		credentialsPageQuery(
			'actor',
			'/@acme/-/credentials?q=key&kind=secret&scope=org&locked=true',
		).queryKey,
	).toEqual(key)
	for (const [actor, href] of [
		['other', '/@acme/-/credentials'],
		['actor', '/@other/-/credentials'],
		['actor', '/@acme/-/credentials/one'],
	])
		expect(credentialsPageQuery(actor!, href!).queryKey).not.toEqual(key)
	expect(
		credentialsPageQuery('actor', '/@acme/-/credentials').meta
			?.freshAuthorization,
	).toBe(true)
})

test('filter validation preserves valid values and rejects unsupported kinds and scopes', () => {
	expect(
		validateCredentialSearch({
			kind: 'secret',
			scope: 'org',
			packageScoped: 'false',
			locked: 'package-id',
			q: ' key ',
		}),
	).toEqual({
		kind: 'secret',
		scope: 'org',
		packageScoped: false,
		locked: 'package-id',
		q: ' key ',
	})
	expect(
		validateCredentialSearch({ kind: ['oauth', 'invalid'], scope: 'any' }).kind,
	).toEqual(['oauth'])
	expect(
		validateCredentialSearch({ kind: 'invalid', scope: 'any' }).scope,
	).toBeUndefined()
})

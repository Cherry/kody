import { expect, test, vi } from 'vitest'
vi.mock('#start/server/credentials', () => ({ loadCredentialsPage: vi.fn() }))
import {
	credentialsPageQuery,
	validateCredentialSearch,
} from './credentials-query.ts'

test('credential resource keys isolate actors, orgs and selections without presentation filters', () => {
	const key = credentialsPageQuery('actor', { orgSlug: 'acme' }).queryKey
	expect(key).toEqual([
		'page',
		'actor',
		'loadCredentialsPage',
		{ orgSlug: 'acme' },
	])
	expect(
		credentialsPageQuery('other', { orgSlug: 'acme' }).queryKey,
	).not.toEqual(key)
	expect(
		credentialsPageQuery('actor', { orgSlug: 'other' }).queryKey,
	).not.toEqual(key)
	expect(
		credentialsPageQuery('actor', { orgSlug: 'acme', credentialId: 'one' })
			.queryKey,
	).not.toEqual(key)
	expect(
		credentialsPageQuery('actor', { orgSlug: 'acme' }).meta?.freshAuthorization,
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

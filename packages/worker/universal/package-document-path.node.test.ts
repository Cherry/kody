import { expect, test } from 'vitest'
import { parsePackageDocumentPath } from './package-document-path.ts'

test('reads package identity without decoding file paths twice', () => {
	expect(
		parsePackageDocumentPath(
			'/@team/my%20package/tree/feature%2Fone/src/a%2520b.ts',
		),
	).toEqual({
		kind: 'package-tree',
		username: 'team',
		kodyId: 'my package',
		ref: 'feature/one',
		relativePath: 'src/a%2520b.ts',
	})
})
test('distinguishes document identities from protocol and unrelated URLs', () => {
	expect(parsePackageDocumentPath('/@team/pkg/raw/main/file.ts')).toBeNull()
	expect(parsePackageDocumentPath('/@team/-/settings/members')).toBeNull()
	expect(parsePackageDocumentPath('/community/id/files/a/b')).toEqual({
		kind: 'listing-files',
		listingId: 'id',
		relativePath: 'a/b',
	})
	expect(parsePackageDocumentPath('/account/packages/id/files')).toEqual({
		kind: 'account-files',
		packageId: 'id',
		relativePath: '',
	})
	expect(parsePackageDocumentPath('/@team/pkg/settings')).toEqual({
		kind: 'package-tab',
		username: 'team',
		kodyId: 'pkg',
		tab: 'settings',
	})
	expect(parsePackageDocumentPath('/@team/pkg/tree/')).toBeNull()
	expect(parsePackageDocumentPath('/@%zz/pkg')).toBeNull()
})

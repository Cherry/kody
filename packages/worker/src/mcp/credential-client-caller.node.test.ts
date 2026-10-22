import { expect, test } from 'vitest'
import {
	createCredentialClientOwnerOnlyMessage,
	resolveCallerCredentialPackageId,
} from './credential-client-tools.ts'

test('credential client calls act as the calling package, never a named one', () => {
	expect(
		resolveCallerCredentialPackageId({
			requested: undefined,
			callerPackageId: 'pkg-a',
		}),
	).toBe('pkg-a')
	expect(
		resolveCallerCredentialPackageId({
			requested: 'pkg-a',
			callerPackageId: 'pkg-a',
		}),
	).toBe('pkg-a')
	expect(
		resolveCallerCredentialPackageId({
			requested: '  ',
			callerPackageId: null,
		}),
	).toBeNull()
	expect(() =>
		resolveCallerCredentialPackageId({
			requested: 'pkg-b',
			callerPackageId: 'pkg-a',
		}),
	).toThrow(createCredentialClientOwnerOnlyMessage('pkg-b'))
	expect(() =>
		resolveCallerCredentialPackageId({
			requested: 'pkg-b',
			callerPackageId: null,
		}),
	).toThrow(createCredentialClientOwnerOnlyMessage('pkg-b'))
})

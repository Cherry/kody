import { expect, test, vi } from 'vitest'
const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('#start/server/credential-approval-mutation', () => ({
	savePackageCredentialMappings: save,
}))
import { postPackageCredentialChanges } from './package-credential-changes.ts'
const input = {
	username: 'team',
	kodyId: 'repo',
	changes: [
		{
			target: { type: 'default' as const, layer: 'mine' as const },
			needKey: 'github',
			credentials: [{ id: 'credential' }],
		},
	],
}
test('mapping writes preserve success, refusal, stale conflict, and session expiry', async () => {
	save.mockResolvedValue({ ok: true, needs: [] })
	expect(await postPackageCredentialChanges(input)).toEqual({
		kind: 'saved',
		view: { ok: true, needs: [] },
	})
	expect(save).toHaveBeenCalledWith({ data: input })
	const errors = [{ code: 'forbidden', needKey: 'github', message: 'Denied' }]
	save.mockResolvedValue({ ok: false, errors })
	expect(await postPackageCredentialChanges(input)).toEqual({
		kind: 'refused',
		errors,
	})
	save.mockResolvedValue({ ok: false, error: 'Mapping changed' })
	expect(await postPackageCredentialChanges(input)).toEqual({
		kind: 'error',
		message: 'Mapping changed',
	})
	save.mockRejectedValue(new Error('Please sign in again.'))
	expect(await postPackageCredentialChanges(input)).toEqual({
		kind: 'unauthorized',
	})
})

import { expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	user: { mcpUser: { userId: 'person-1' } },
	loadScope: vi.fn(),
	resolve: vi.fn(),
}))
vi.mock('#app/authenticated-user.ts', () => ({
	readAuthenticatedAppUser: async () => mocks.user,
}))
vi.mock('#app/package-credentials-access.ts', () => ({
	loadPackageMappingScopeForViewer: mocks.loadScope,
}))
vi.mock('#worker/credentials/credential-approval.ts', () => ({
	resolveCredentialApproval: mocks.resolve,
	approveCredentialProposal: vi.fn(),
}))
import { createPackageCredentialApprovalApiHandler } from './package-credential-approval.ts'

// Native Start's approval loader calls this same authorization/data boundary.
// Native redirect and execute-only document coverage lives in start/server/credentials.node.test.ts.
test('the approval read used by Start grants execute scope and rejects missing grants', async () => {
	const url = new URL(
		'https://kody.test/@acme/digest/approve-credentials?mine[mail]=resend-prod',
	)
	const call = () =>
		createPackageCredentialApprovalApiHandler({} as Env).handler({
			request: new Request(url),
			url,
			params: { username: 'acme', kodyId: 'digest' },
		})
	mocks.loadScope.mockResolvedValueOnce({ baseUrl: 'https://kody.test' })
	mocks.resolve.mockResolvedValueOnce({
		view: { ok: true, fingerprint: 'reviewed' },
	})
	const response = await call()
	expect(response.status).toBe(200)
	expect(await response.json()).toEqual({ ok: true, fingerprint: 'reviewed' })
	expect(mocks.loadScope).toHaveBeenCalledWith(
		expect.objectContaining({
			user: mocks.user,
			username: 'acme',
			kodyId: 'digest',
		}),
	)
	mocks.loadScope.mockResolvedValueOnce(null)
	expect((await call()).status).toBe(404)
	expect(mocks.resolve).toHaveBeenCalledTimes(1)
})

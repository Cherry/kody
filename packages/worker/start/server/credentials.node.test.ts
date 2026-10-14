import { beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
	page: { kind: 'not-found' } as Record<string, unknown>,
	approval: vi.fn(),
	collection: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
	createServerOnlyFn: <T>(fn: T) => fn,
	createServerFn: () => {
		let validate = (data: unknown) => data
		const builder = {
			validator(next: typeof validate) {
				validate = next
				return builder
			},
			handler(run: (input: { data: unknown }) => Promise<unknown>) {
				return (input: { data: unknown }) => run({ data: validate(input.data) })
			},
		}
		return builder
	},
}))
vi.mock('@tanstack/react-router', () => ({
	redirect: (options: unknown) => ({ redirect: options }),
	notFound: () => ({ notFound: true }),
}))
vi.mock('./account-collections', () => ({ loadCollection: state.collection }))
vi.mock('../../src/app/account-credentials-data', () => ({
	loadAccountCredentialsData: vi.fn(),
}))
vi.mock('./document-head', () => ({ loadDocumentHead: () => ({}) }))
vi.mock('../../src/app/package-page', () => ({
	loadPackagePage: async () => state.page,
	packagePageIsPrivate: () => true,
}))
vi.mock('../../src/app/handlers/package-credential-approval', () => ({
	createPackageCredentialApprovalApiHandler: () => ({
		handler: state.approval,
	}),
}))
import { loadCredentialApprovalPage, loadCredentialsPage } from './credentials'
const href = '/@acme/digest/approve-credentials?default%5Bgithub%5D=org%3Abot'
beforeEach(() => {
	state.page = { kind: 'not-found' }
	state.approval
		.mockReset()
		.mockResolvedValue(
			Response.json({ ok: true, fingerprint: 'fp', changes: [] }),
		)
	state.collection.mockReset().mockImplementation(async (path: string) => ({
		bindings: {},
		request: new Request(`https://kody.test${path}`),
	}))
})
test('execute-only viewers can review approval without package read access', async () => {
	const result = await loadCredentialApprovalPage({ data: href })
	expect(result.payload.view.fingerprint).toBe('fp')
	expect(state.approval.mock.calls[0]?.[0].url.search).toBe(
		new URL(href, 'https://kody.test').search,
	)
})
test('moved packages preserve approval proposal and skip the obsolete API path', async () => {
	state.page = { kind: 'redirect', to: '/@acme/new-digest' }
	await expect(loadCredentialApprovalPage({ data: href })).rejects.toEqual({
		redirect: {
			href: '/@acme/new-digest/approve-credentials?default%5Bgithub%5D=org%3Abot',
			statusCode: 302,
		},
	})
	expect(state.approval).not.toHaveBeenCalled()
})
test('approval enforces API execute access even when document authentication succeeds', async () => {
	state.approval.mockResolvedValue(
		Response.json({ ok: false }, { status: 404 }),
	)
	await expect(loadCredentialApprovalPage({ data: href })).rejects.toEqual({
		notFound: true,
	})
})
test('an expired API session returns to the exact proposal after login', async () => {
	state.approval.mockResolvedValue(
		Response.json({ ok: false }, { status: 401 }),
	)
	await expect(loadCredentialApprovalPage({ data: href })).rejects.toEqual({
		redirect: { href: `/login?redirectTo=${encodeURIComponent(href)}` },
	})
})

test('credential creation gives the authentication boundary the full return URL', async () => {
	const input = '/@acme/-/credentials/new?kind=secret&name=x'
	const redirect = {
		redirect: { href: `/login?redirectTo=${encodeURIComponent(input)}` },
	}
	state.collection.mockRejectedValueOnce(redirect)
	await expect(loadCredentialsPage({ data: input })).rejects.toEqual(redirect)
	expect(state.collection).toHaveBeenCalledWith(input)
})

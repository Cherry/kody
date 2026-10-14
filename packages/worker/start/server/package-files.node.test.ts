import { beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
	target: {} as Record<string, unknown>,
	headers: vi.fn(),
	auth: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
	createServerFn: () => {
		let validate = (data: unknown) => data
		const builder = {
			validator(next: typeof validate) {
				validate = next
				return builder
			},
			handler(run: (input: { data: unknown }) => Promise<unknown>) {
				return async (input: { data: unknown }) =>
					run({ data: validate(input.data) })
			},
		}
		return builder
	},
}))
vi.mock('@tanstack/react-router', () => ({
	redirect: (options: unknown) => ({ redirect: options }),
	notFound: () => ({ notFound: true }),
}))
vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => new Request('https://kody.test/_serverFn/read'),
	setResponseHeader: state.headers,
}))
vi.mock('../../src/app/env.ts', () => ({ getEnv: () => ({}) }))
vi.mock('../../src/app/auth-session.ts', () => ({
	setAuthSessionSecret: vi.fn(),
}))
vi.mock('../../src/app/community-package-route.ts', () => ({
	resolveCommunityFilesRoute: async () => state.target,
}))
vi.mock('../../src/app/package-files-data.ts', () => ({
	loadAccessiblePackageFilesData: vi.fn(),
	loadListingFilesData: vi.fn(),
}))
vi.mock('../../src/app/page-auth.ts', () => ({
	requireAuthenticatedPageUser: state.auth,
}))
vi.mock('../../src/package-registry/repo.ts', () => ({
	getSavedPackageByIdInAnyOrg: async () => ({
		id: 'pkg',
		userId: 'org-id',
		kodyId: 'digest',
	}),
}))
vi.mock('../../src/app/package-viewer-access.ts', () => ({
	viewerCanReadSavedPackage: async () => true,
}))
vi.mock('../../src/orgs/repo.ts', () => ({
	loadOrgBindingForOrg: async () => ({ org: { slug: 'acme' } }),
}))
vi.mock('./document-head.ts', () => ({ loadDocumentHead: vi.fn() }))
import { loadPackageFiles } from './package-files.ts'
beforeEach(() => {
	vi.clearAllMocks()
	state.auth.mockResolvedValue({
		username: 'person',
		mcpUser: { userId: 'person-id' },
	})
})
test('public canonical redirect preserves query and fragment and permanent status', async () => {
	state.target = {
		kind: 'redirect',
		to: '/@acme/digest/tree/main/README.md',
		shared: true,
	}
	await expect(
		loadPackageFiles({
			data: { pathname: '/@acme/digest/files/README.md?view=source#L4' },
		}),
	).rejects.toEqual({
		redirect: {
			href: 'https://kody.test/@acme/digest/tree/main/README.md?view=source#L4',
			statusCode: 301,
		},
	})
	expect(state.headers).toHaveBeenCalledWith(
		'Cache-Control',
		'public, max-age=3600',
	)
})
test('private file login resumes the exact requested location', async () => {
	state.target = { kind: 'unauthorized' }
	const pathname = '/@acme/digest/tree/main/README.md?view=source#L4'
	await expect(loadPackageFiles({ data: { pathname } })).rejects.toEqual({
		redirect: {
			href: `/login?redirectTo=${encodeURIComponent(pathname)}`,
			statusCode: 302,
		},
	})
})
test('account file alias preserves suffix and resolves the package organization', async () => {
	const pathname = '/account/packages/pkg/files/README.md?view=source#L4'
	await expect(loadPackageFiles({ data: { pathname } })).rejects.toMatchObject({
		redirect: {
			href: expect.stringMatching(
				/^\/@acme\/digest\/tree\/[^/]+\/README\.md\?view=source#L4$/,
			),
			statusCode: 302,
		},
	})
	expect(state.auth).toHaveBeenCalledWith(
		expect.any(Request),
		expect.anything(),
		{ redirectTo: pathname },
	)
	expect(state.headers).toHaveBeenCalledWith(
		'Cache-Control',
		'private, no-store',
	)
})
test.each(['//evil.test/files', '/\\evil.test/files', '/%5cevil.test/files'])(
	'rejects unsafe file location %s',
	async (pathname) => {
		await expect(loadPackageFiles({ data: { pathname } })).rejects.toEqual({
			notFound: true,
		})
		expect(state.auth).not.toHaveBeenCalled()
	},
)

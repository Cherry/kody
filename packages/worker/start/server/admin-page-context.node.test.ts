import { beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
	read: vi.fn(),
	resolved: vi.fn(),
	header: vi.fn(),
	status: vi.fn(),
	request: new Request('https://kody.test/_serverFn/admin'),
}))
vi.mock('cloudflare:workers', () => ({ env: { COOKIE_SECRET: 'test' } }))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => state.request,
	setResponseHeader: state.header,
	setResponseStatus: state.status,
}))
vi.mock('../../src/app/env.ts', () => ({ getEnv: (value: unknown) => value }))
vi.mock('../../src/app/auth-session.ts', () => ({
	setAuthSessionSecret: vi.fn(),
}))
vi.mock('../../src/app/authenticated-user.ts', () => ({
	readAuthenticatedAppUser: state.read,
}))
vi.mock('../../src/app/request-auth-cache.ts', () => ({
	loadResolvedRequestAuth: state.resolved,
}))
import { readAdminPageContext } from './admin-page-context.ts'
beforeEach(() => {
	vi.clearAllMocks()
	state.resolved.mockResolvedValue({ setCookie: 'kody_session=; Max-Age=0' })
})
test('unauthenticated reads clear stale cookies and redirect to the explicit admin destination', async () => {
	state.read.mockResolvedValue(null)
	const failure = await readAdminPageContext('/admin/users?q=ada').catch(
		(error) => error,
	)
	expect(failure.options.href).toBe(
		'/login?redirectTo=%2Fadmin%2Fusers%3Fq%3Dada',
	)
	expect(state.header).toHaveBeenCalledWith(
		'Set-Cookie',
		'kody_session=; Max-Age=0',
	)
})
test('non-admin reads return forbidden state without serializing a transport response', async () => {
	state.read.mockResolvedValue({ roles: ['user'] })
	const context = await readAdminPageContext('/admin/users')
	expect(context.user).toBeNull()
	expect(state.status).toHaveBeenCalledWith(403)
	expect(context.request).toBe(state.request)
	expect(context.url.pathname).toBe('/admin/users')
})
test('admin reads use the original authenticated request and private cache policy', async () => {
	const user = { roles: ['admin'] }
	state.read.mockResolvedValue(user)
	const context = await readAdminPageContext('/admin/users')
	expect(context.user).toBe(user)
	expect(state.read).toHaveBeenCalledWith(state.request, expect.anything(), {
		prefetchFeatureFlags: true,
	})
	expect(state.header).toHaveBeenCalledWith(
		'Cache-Control',
		'private, no-store',
	)
})

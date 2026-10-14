import { beforeEach, expect, test, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ denied: vi.fn(), lease: vi.fn(), env: {} }))
vi.mock('cloudflare:workers', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	get env() {
		return mocks.env
	},
}))
vi.mock('#app/env.ts', () => ({ getEnv: () => mocks.env }))
vi.mock('#app/org-binding-guard-middleware.ts', () => ({
	orgRequestIsDenied: mocks.denied,
}))
vi.mock('#app/account-write-lease-middleware.ts', () => ({
	withProtocolAccountWriteLease: mocks.lease,
}))
vi.mock('#start/server/document-actor', () => ({
	verifyBrowserDocument: vi.fn(),
	markRpcResponsePrivate: vi.fn(),
}))
import { startInstance } from './start.ts'
const middleware = (await startInstance.getOptions()).requestMiddleware![2]!
const server = middleware.options.server!
beforeEach(() => {
	mocks.denied.mockReset().mockResolvedValue(false)
	mocks.lease
		.mockReset()
		.mockImplementation(
			async (_request: Request, _env: unknown, next: () => Promise<unknown>) =>
				next(),
		)
})
async function run(
	path: string,
	handlerType: 'router' | 'serverFn' = 'router',
	method = 'GET',
) {
	const request = new Request(`https://kody.test${path}`, { method })
	const response = new Response('native document', {
		headers: { 'Set-Cookie': 'session=existing; HttpOnly' },
	})
	const next = vi.fn((options?: { context?: unknown }) => ({
		request,
		pathname: new URL(request.url).pathname,
		context: options?.context ?? {},
		response,
	}))
	const result = await server({
		request,
		pathname: new URL(request.url).pathname,
		context: undefined,
		handlerType,
		next: next as Parameters<typeof server>[0]['next'],
	})
	return { result, next, response }
}
test('denied documents enter native rendering with trusted404 context', async () => {
	mocks.denied.mockResolvedValue(true)
	const { result, next } = await run('/@outsider/-/secrets')
	expect(next).toHaveBeenCalledWith({
		context: { documentFailure: { status: 404 } },
	})
	expect(result).toMatchObject({
		context: { documentFailure: { status: 404 } },
	})
})
test('denied protocol requests stop before handlers and leases', async () => {
	mocks.denied.mockResolvedValue(true)
	const { result, next } = await run(
		'/account/memories-export.json?org=outsider',
	)
	expect(next).not.toHaveBeenCalled()
	expect(mocks.lease).not.toHaveBeenCalled()
	expect(result).toBeInstanceOf(Response)
	if (!(result instanceof Response)) throw new Error('Expected denial response')
	expect(result.status).toBe(404)
	expect(await result.json()).toEqual({
		ok: false,
		error: 'Organization not found.',
	})
})
test('RPC bypasses document org policy and outer write lease', async () => {
	const { next } = await run('/_serverFn/write', 'serverFn', 'POST')
	expect(next).toHaveBeenCalledOnce()
	expect(mocks.denied).not.toHaveBeenCalled()
	expect(mocks.lease).not.toHaveBeenCalled()
})
test('native middleware preserves result context and appends referral to final cookies', async () => {
	const { result } = await run('/signup?ref=ada')
	if (result instanceof Response)
		throw new Error('Expected native middleware result')
	expect(result.response.headers.getSetCookie()).toEqual([
		'session=existing; HttpOnly',
		expect.stringContaining('kody_ref=ada;'),
	])
	expect(result.response.headers.get('Cache-Control')).toBe('no-store')
	expect(result.context).toEqual({})
	expect(mocks.lease).toHaveBeenCalledOnce()
})

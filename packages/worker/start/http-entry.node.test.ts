import { expect, test, vi } from 'vitest'
import { firstPartySecurityHeaders } from '../src/app/security-headers.ts'
import { getEnv } from '../src/app/env.ts'
import { createHttpRequestHandler } from './http-entry.ts'
import { markSentryReported } from '../src/app/sentry-reported-error.ts'
import { silenceExpectedConsoleErrors } from '#worker/test-support/console-spies.ts'
import { testOidcSigningEnv } from '#worker/test-support/oidc-signing-env.ts'

const captureException = vi.fn()
const renderDocument = vi.fn(async (request: Request) => {
	const error = new Error('Renderer unavailable')
	if (request.headers.get('x-kody-test-reported-error') === '1')
		markSentryReported(error)
	throw error
})
const handleRequest = createHttpRequestHandler(renderDocument)

vi.mock('@sentry/cloudflare', async () => {
	const stub = await import('#worker/test-support/sentry-cloudflare-stub.ts')
	return {
		...stub,
		captureException: (...args: Array<unknown>) => captureException(...args),
	}
})

function createEnv(overrides: Record<string, unknown> = {}) {
	return {
		COOKIE_SECRET: 'LOCAL_TEST_COOKIE_SECRET_32_CHARS_MINIMUM',
		SECRET_STORE_KEY: 'LOCAL_TEST_SECRET_STORE_KEY_32_CHARS_MINIMUM',
		...testOidcSigningEnv,
		APP_DB: {},
		BUNDLE_ARTIFACTS_KV: {},
		JOB_MANAGER: {},
		STORAGE_RUNNER: {},
		PACKAGE_REALTIME_SESSION: {},
		MCP_CLIENT_HUB: {},
		...overrides,
	} as unknown as Env
}

test('server-function requests reach Start without legacy endpoint authorization', async () => {
	vi.stubEnv('TSS_SERVER_FN_BASE', '/_serverFn/')
	const render = vi.fn(async () => new Response('rpc'))
	const handle = createHttpRequestHandler(render)
	const request = new Request('https://example.com/_serverFn/test', {
		method: 'POST',
		headers: { 'x-tsr-serverFn': 'true' },
	})
	const response = await handle(request, createEnv())
	expect(response.status).toBe(200)
	expect(render).toHaveBeenCalledWith(request, expect.anything(), undefined)
	vi.unstubAllEnvs()
})

test('getEnv memoizes per env identity and requires AUTH_RATE_LIMITER in production', () => {
	const env = createEnv()
	expect(getEnv(env)).toBe(getEnv(env))
	expect(getEnv(createEnv())).not.toBe(getEnv(env))
	expect(() => getEnv(createEnv({ SENTRY_ENVIRONMENT: 'production' }))).toThrow(
		'AUTH_RATE_LIMITER',
	)
	expect(() =>
		getEnv(
			createEnv({ SENTRY_ENVIRONMENT: 'production', AUTH_RATE_LIMITER: {} }),
		),
	).not.toThrow()
})

test('HTTP boundary dispatches multiple requests from the same env to Start', async () => {
	const render = vi.fn(async () => Response.json({ ok: true }))
	const handle = createHttpRequestHandler(render)
	const env = createEnv()
	const first = await handle(new Request('https://example.com/health'), env)
	const second = await handle(new Request('https://example.com/health'), env)
	expect(first.status).toBe(200)
	expect(second.status).toBe(200)
	expect(render).toHaveBeenCalledTimes(2)
	await expect(second.json()).resolves.toMatchObject({ ok: true })
})

test('invalid bindings return the static illustrated 500 with document title, lang, and CSP', async () => {
	silenceExpectedConsoleErrors([
		'Native app request failed:',
		'Native error document failed:',
	])
	captureException.mockClear()
	const response = await handleRequest(
		new Request('https://example.com/health'),
		createEnv({ SENTRY_ENVIRONMENT: 'production' }),
	)
	const body = await response.text()

	expect(response.status).toBe(500)
	expect(response.headers.get('content-type')).toMatch(/text\/html/)
	expect(body).toContain('lang="en"')
	expect(body).toContain('<title>Something went wrong — Kody</title>')
	expect(body).toContain('data-testid="internal-error-page"')
	expect(body).toContain('data-error-agent-prompt')
	expect(body).toContain('We got a little zapped.')
	expect(body).toContain('src="/images/kody-500-zapped.png"')
	expect(body).toContain('Try again')
	expect(body).toContain('href="/"')
	expect(response.headers.get('Content-Security-Policy')).toBe(
		firstPartySecurityHeaders['Content-Security-Policy'],
	)
	expect(captureException).toHaveBeenCalledTimes(1)
	expect(captureException).toHaveBeenCalledWith(
		expect.any(Error),
		expect.objectContaining({
			tags: expect.objectContaining({
				surface: 'app-router',
				pathname: '/health',
			}),
		}),
	)
})

test('handleRequest skips Sentry when SSR already reported the failure', async () => {
	silenceExpectedConsoleErrors([
		'Native app request failed:',
		'Native error document failed:',
	])
	captureException.mockClear()
	const response = await handleRequest(
		new Request('https://example.com/account', {
			headers: { 'x-kody-test-reported-error': '1' },
		}),
		createEnv({ AUTH_RATE_LIMITER: {} }),
	)

	expect(response.status).toBe(500)
	expect(captureException).not.toHaveBeenCalled()
})

test('unmapped document requests go to the native renderer with the original URL', async () => {
	const render = vi.fn(async () => new Response('document'))
	const handle = createHttpRequestHandler(render)
	const request = new Request(
		'https://example.com/blog/kody-vs-executor?test=1',
	)
	const response = await handle(request, createEnv())
	expect(response.status).toBe(200)
	expect(render).toHaveBeenCalledWith(request, expect.anything(), undefined)
})

test('a failed native mutation is never dispatched again to render an error', async () => {
	silenceExpectedConsoleErrors(['Native app request failed:'])
	vi.stubEnv('TSS_SERVER_FN_BASE', '/_serverFn/')
	try {
		let committedWrites = 0
		const render = vi.fn(async () => {
			committedWrites++
			throw new Error('failed after commit')
		})
		const handle = createHttpRequestHandler(render)
		const response = await handle(
			new Request('https://example.com/_serverFn/mutation', { method: 'POST' }),
			createEnv(),
		)
		expect(response.status).toBe(500)
		expect(await response.text()).toContain('/images/kody-500-zapped.png')
		expect(committedWrites).toBe(1)
		expect(render).toHaveBeenCalledTimes(1)
	} finally {
		vi.unstubAllEnvs()
	}
})

test('legacy org connection bookmarks redirect through the native route', async () => {
	const { connectionsRedirect } = await import('./server/legacy-redirects.ts')
	const response = connectionsRedirect({
		request: new Request(
			'https://example.com/@acme/-/connections/usage?connection=abc',
		),
	})
	expect(response.status).toBe(301)
	expect(response.headers.get('Location')).toBe(
		'/@acme/-/agents/usage?connection=abc',
	)
})

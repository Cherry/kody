import { expect, test, vi } from 'vitest'
import { firstPartySecurityHeaders } from '../src/app/security-headers.ts'
import { getEnv } from '../src/app/env.ts'
import { createHttpRequestHandler } from './http-entry.ts'
import { markSentryReported } from '../src/app/sentry-reported-error.ts'
import { silenceExpectedConsoleErrors } from '#worker/test-support/console-spies.ts'
import { testOidcSigningEnv } from '#worker/test-support/oidc-signing-env.ts'

const captureException = vi.fn()
const renderDocument = vi.fn(async () => {
	throw new Error('Renderer unavailable')
})
const handleRequest = createHttpRequestHandler(renderDocument)

vi.mock('@sentry/cloudflare', async () => {
	const stub = await import('#worker/test-support/sentry-cloudflare-stub.ts')
	return {
		...stub,
		captureException: (...args: Array<unknown>) => captureException(...args),
	}
})

vi.mock('./backend-router.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./backend-router.ts')>()
	return {
		...actual,
		createBackendRouter(
			...args: Parameters<typeof actual.createBackendRouter>
		) {
			const router = actual.createBackendRouter(...args)
			return {
				fetch(request: Request) {
					if (request.headers.get('x-kody-test-reported-error') === '1') {
						const error = new Error('ssr already reported')
						markSentryReported(error)
						return Promise.reject(error)
					}
					return router.fetch(request)
				},
			}
		},
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

test('account secrets api ignores legacy remote connector env secrets', async () => {
	const response = await handleRequest(
		new Request('https://example.com/account/secrets.json'),
		createEnv({}),
	)

	expect(response.status).toBe(401)
	await expect(response.json()).resolves.toEqual({
		ok: false,
		error: 'Unauthorized.',
	})
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

test('handleRequest serves multiple requests from the same env object', async () => {
	const env = createEnv()
	const first = await handleRequest(
		new Request('https://example.com/health'),
		env,
	)
	const second = await handleRequest(
		new Request('https://example.com/health'),
		env,
	)

	expect(first.status).toBe(200)
	expect(second.status).toBe(200)
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
	expect(render).toHaveBeenCalledWith(
		request,
		expect.anything(),
		undefined,
		undefined,
	)
})

test('an uncaught backend error uses native 500 rendering before the static fallback', async () => {
	silenceExpectedConsoleErrors(['Native app request failed:'])
	const render = vi.fn(
		async () => new Response('native error', { status: 500 }),
	)
	const handle = createHttpRequestHandler(render)
	const request = new Request('https://example.com/health', {
		headers: { 'x-kody-test-reported-error': '1' },
	})
	const response = await handle(request, createEnv())
	expect(response.status).toBe(500)
	await expect(response.text()).resolves.toBe('native error')
	expect(render).toHaveBeenCalledWith(request, expect.anything(), undefined, {
		status: 500,
	})
})

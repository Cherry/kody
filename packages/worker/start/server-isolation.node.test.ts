import { expect, test, vi } from 'vitest'

const { buildRouter, renderStart } = vi.hoisted(() => ({
	buildRouter: vi.fn(
		(_env: unknown, render: (request: Request) => Promise<Response>) => ({
			fetch: render,
		}),
	),
	renderStart: vi.fn(
		async (
			request: Request,
			options: {
				context: {
					nonce: string
					oauthPage?: { setCookie?: string; href: string }
				}
			},
		) => {
			// Yield so simultaneous requests overlap across the same cached router.
			await new Promise<void>((resolve) =>
				setTimeout(resolve, request.url.endsWith('/pricing') ? 5 : 0),
			)
			return new Response(
				JSON.stringify({ url: request.url, ...options.context }),
				{ headers: { 'Content-Type': 'text/html' } },
			)
		},
	),
}))
vi.mock('./backend-router.ts', () => ({ createBackendRouter: buildRouter }))
vi.mock('@tanstack/react-start/server', () => ({
	createStartHandler: () => renderStart,
	defaultStreamHandler: vi.fn(),
	getResponseStatus: () => 200,
}))
vi.mock('../src/app/env.ts', () => ({ getEnv: (env: unknown) => env }))
vi.mock('../src/app/auth-session.ts', () => ({ setAuthSessionSecret: vi.fn() }))

import { handleRequest } from './server.ts'

test('cached backend routing creates a fresh matching nonce for overlapping requests', async () => {
	const env = {
		COOKIE_SECRET: 'test-only',
		WRANGLER_IS_LOCAL_DEV: 'true',
	} as Env
	const before = buildRouter.mock.calls.length
	const requests = ['/pricing', '/faq'].map(
		(path) => new Request(`https://kody.test${path}`),
	)
	const responses = await Promise.all(
		requests.map((request) => handleRequest(request, env)),
	)
	const bodies = await Promise.all(
		responses.map(
			(response) =>
				response.json() as Promise<{
					nonce: string
					url: string
					oauthPage?: unknown
				}>,
		),
	)
	expect(buildRouter.mock.calls.length - before).toBe(1)
	expect(bodies[0]?.nonce).not.toBe(bodies[1]?.nonce)
	for (const [index, response] of responses.entries()) {
		expect(response.headers.get('Content-Security-Policy')).toContain(
			`'nonce-${bodies[index]?.nonce}'`,
		)
		expect(bodies[index]?.url).toBe(requests[index]?.url)
		expect(bodies[index]?.oauthPage).toBeUndefined()
	}
})

test('trusted OAuth options and cookies never enter the reusable router', async () => {
	const env = {
		COOKIE_SECRET: 'test-only',
		WRANGLER_IS_LOCAL_DEV: 'true',
	} as Env
	const oauth = new Request('https://kody.test/oauth/authorize?state=one')
	const ordinary = new Request('https://kody.test/pricing')
	const [oauthResponse, ordinaryResponse] = await Promise.all([
		handleRequest(oauth, env, undefined, {
			status: 400,
			setCookie: 'oauth_state=one; HttpOnly',
		}),
		handleRequest(ordinary, env),
	])
	const oauthBody = (await oauthResponse.json()) as {
		nonce: string
		oauthPage: { href: string }
	}
	const ordinaryBody = (await ordinaryResponse.json()) as {
		nonce: string
		oauthPage?: unknown
	}
	expect(oauthResponse.status).toBe(400)
	expect(oauthResponse.headers.get('Set-Cookie')).toBe(
		'oauth_state=one; HttpOnly',
	)
	expect(oauthBody.oauthPage.href).toBe(oauth.url)
	expect(ordinaryResponse.status).toBe(200)
	expect(ordinaryResponse.headers.get('Set-Cookie')).toBeNull()
	expect(ordinaryBody.oauthPage).toBeUndefined()
	expect(ordinaryBody.nonce).not.toBe(oauthBody.nonce)
	const later = await handleRequest(new Request('https://kody.test/faq'), env)
	expect(later.headers.get('Set-Cookie')).toBeNull()
	expect(await later.json()).not.toHaveProperty('oauthPage')
})

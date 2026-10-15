import { expect, test, vi } from 'vitest'

const { renderStart } = vi.hoisted(() => ({
	renderStart: vi.fn(
		async (
			request: Request,
			options: {
				context: {
					nonce: string
				}
			},
		) => {
			// Yield so simultaneous requests overlap across the same Start handler.
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
vi.mock('@tanstack/react-start/server', () => ({
	createStartHandler: () => renderStart,
	defaultStreamHandler: vi.fn(),
	getResponseStatus: () => 200,
}))
vi.mock('../src/app/env.ts', () => ({ getEnv: (env: unknown) => env }))
vi.mock('../src/app/auth-session.ts', () => ({
	setAuthSessionSecret: vi.fn(),
}))

import { handleRequest } from './http-entry.ts'

test('Start creates a fresh matching nonce for overlapping requests', async () => {
	const env = {
		COOKIE_SECRET: 'test-only',
		WRANGLER_IS_LOCAL_DEV: 'true',
	} as Env
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
				}>,
		),
	)
	expect(bodies[0]?.nonce).not.toBe(bodies[1]?.nonce)
	for (const [index, response] of responses.entries()) {
		expect(response.headers.get('Content-Security-Policy')).toContain(
			`'nonce-${bodies[index]?.nonce}'`,
		)
		expect(bodies[index]?.url).toBe(requests[index]?.url)
	}
})

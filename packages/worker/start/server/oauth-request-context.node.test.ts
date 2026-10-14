import { expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
	request: new Request('https://kody.test/_serverFn/oauth?transport=true', {
		headers: { cookie: 'session=original' },
	}),
	read: vi.fn(async (_request: Request, _env: unknown, _url: URL) => ({
		data: { ok: false, error: 'invalid client', allowClientReset: true },
		setCookie: 'reset=; Max-Age=0',
	})),
	session: vi.fn(async (_request: Request, _env: unknown) => ({
		session: null,
		setCookie: 'session=rotated',
	})),
	header: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
	getGlobalStartContext: () => undefined,
	createServerFn: () => {
		let validate: (value: unknown) => unknown
		const builder = {
			validator(next: typeof validate) {
				validate = next
				return builder
			},
			handler(run: (input: { data: unknown }) => unknown) {
				return (input: { data: unknown }) => run({ data: validate(input.data) })
			},
		}
		return builder
	},
}))
vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => state.request,
	setResponseHeader: state.header,
}))
vi.mock('../../src/app/env.ts', () => ({ getEnv: (env: unknown) => env }))
vi.mock('../../src/app/session-info.ts', () => ({
	loadSessionInfo: state.session,
}))
vi.mock('../../src/oauth-handlers.ts', () => ({
	loadOAuthAuthorizeData: state.read,
}))
vi.mock('../../src/app/public-auth-providers.ts', () => ({
	publicAuthProvidersLoaderData: () => [],
}))
import { loadOAuthPage } from './oauth.ts'
test('OAuth page retains original request identity for session and cookie work with separate lossless authorization URL', async () => {
	await loadOAuthPage({
		data: '?client_id=first&client_id=second&org=team-a&prompt=login',
	})
	expect(state.read).toHaveBeenCalledWith(
		state.request,
		{},
		new URL(
			'https://kody.test/oauth/authorize?client_id=first&client_id=second&org=team-a&prompt=login',
		),
	)
	expect(state.session).toHaveBeenCalledWith(state.request, {})
	expect(state.header).toHaveBeenCalledWith('Set-Cookie', [
		'reset=; Max-Age=0',
		'session=rotated',
	])
	expect(state.request.url).toBe(
		'https://kody.test/_serverFn/oauth?transport=true',
	)
})

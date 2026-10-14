import { expect, test, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from '@tanstack/react-router'
import { createPageQuery, loadPageQuery } from './page-query.ts'

const state = vi.hoisted(() => ({
	denied: false,
	destinations: [] as string[],
}))
vi.mock('@tanstack/react-start', () => ({
	createServerOnlyFn: <T>(fn: T) => fn,
	createServerFn: () => {
		let validate = (data: unknown) => data
		const builder = {
			validator: (fn: typeof validate) => {
				validate = fn
				return builder
			},
			handler:
				(fn: (input: { data: unknown }) => unknown) =>
				(input: { data?: unknown } = {}) =>
					fn({ data: validate(input.data) }),
		}
		return builder
	},
}))
vi.mock('cloudflare:workers', () => ({ env: { COOKIE_SECRET: 'test' } }))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => new Request('https://kody.test/_serverFn/verify'),
}))
vi.mock('../src/app/env.ts', () => ({ getEnv: (env: unknown) => env }))
vi.mock('../src/app/auth-session.ts', () => ({ setAuthSessionSecret: vi.fn() }))
vi.mock('../src/app/request-auth-cache.ts', () => ({
	loadResolvedRequestAuth: async () => ({
		user: { mcpUser: { userId: 'actor' } },
	}),
}))
vi.mock('../src/app/org-request-binding.ts', () => ({
	isOrgRequestDenied: async (request: Request) => {
		state.destinations.push(new URL(request.url).pathname)
		return state.denied
	},
}))
import { verifySession } from '#start/server/shell'

test('foreground org entry rechecks permission while an authorized warm entry reuses its payload', async () => {
	const client = new QueryClient()
	const read = vi.fn(async () => ({ payload: 'private jobs' }))
	const query = createPageQuery('loadJobsPage', read)
	const href = '/@team/-/jobs'
	const root = createRootRoute({
		notFoundComponent: () => null,
		beforeLoad: ({ location, preload }) =>
			!preload && location.pathname === href
				? verifySession({ data: { pathname: location.pathname } })
				: undefined,
	})
	const jobs = createRoute({
		getParentRoute: () => root,
		path: href,
		loader: ({ preload }) =>
			loadPageQuery(client, query('actor', href), preload),
	})
	const home = createRoute({ getParentRoute: () => root, path: '/' })
	const router = createRouter({
		routeTree: root.addChildren([home, jobs]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		isServer: false,
		origin: 'https://kody.test',
		defaultPreloadStaleTime: 0,
	})
	await router.load()
	await router.navigate({ to: href })
	expect(read).toHaveBeenCalledTimes(1)
	await router.navigate({ to: '/' })
	await router.navigate({ to: href })
	expect(read).toHaveBeenCalledTimes(1)
	expect(state.destinations).toEqual([href, href])
	await router.navigate({ to: '/' })
	state.denied = true
	await router.navigate({ to: href })
	expect(state.destinations).toEqual([href, href, href])
	expect(
		router.state.matches.some(
			(match) => match.status === 'notFound' || match._notFound,
		),
	).toBe(true)
	expect(read).toHaveBeenCalledTimes(1)
	client.clear()
})

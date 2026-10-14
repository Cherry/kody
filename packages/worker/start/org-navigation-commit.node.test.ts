import { expect, test, vi } from 'vitest'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import {
	installOrgNavigationCommit,
	createOrgNavigationCommit,
} from './org-navigation-commit.ts'

const origin = 'https://kody.test'

test('commits only org destinations and does not reread page payloads', async () => {
	const fetcher = vi
		.fn<(slug: string) => Promise<{ ok: boolean }>>()
		.mockResolvedValue({ ok: true })
	const commit = createOrgNavigationCommit(fetcher, origin)
	await commit('/account')
	expect(fetcher).not.toHaveBeenCalled()
	await commit('/@acme/-/jobs')
	await commit('/@acme/-/secrets')
	expect(fetcher).toHaveBeenCalledTimes(1)
	expect(fetcher).toHaveBeenCalledWith('acme')
	await commit('/@other/-/jobs')
	await commit('/@acme/-/jobs')
	expect(fetcher).toHaveBeenCalledTimes(3)
})

test('rapid org switches serialize cookie responses even when an earlier write is slow', async () => {
	let release!: (response: { ok: boolean }) => void
	const fetcher = vi
		.fn<(slug: string) => Promise<{ ok: boolean }>>()
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve
				}),
		)
		.mockResolvedValue({ ok: true })
	const commit = createOrgNavigationCommit(fetcher, origin)
	const first = commit('/@acme/-/jobs')
	const second = commit('/@other/-/jobs')
	await Promise.resolve()
	expect(fetcher).toHaveBeenCalledTimes(1)
	release({ ok: true })
	await Promise.all([first, second])
	expect(fetcher).toHaveBeenCalledTimes(2)
	expect(fetcher.mock.calls[1]?.[0]).toBe('other')
})

test('a failed cookie commit can be retried without failing navigation', async () => {
	const fetcher = vi
		.fn<(slug: string) => Promise<{ ok: boolean }>>()
		.mockRejectedValueOnce(new Error('offline'))
		.mockResolvedValue({ ok: true })
	const commit = createOrgNavigationCommit(fetcher, origin)
	await commit('/@acme/-/jobs')
	await commit('/@acme/-/jobs')
	expect(fetcher).toHaveBeenCalledTimes(2)
})

test('Router preloads do not commit, cached Query navigation does, failed routes do not', async () => {
	let release!: () => void
	const slow = new Promise<void>((resolve) => {
		release = resolve
	})
	const query = new QueryClient()
	const read = vi.fn(async () => ({ ready: true }))
	const root = createRootRoute()
	const router = createRouter({
		routeTree: root.addChildren([
			createRoute({
				getParentRoute: () => root,
				path: '/@slow/-/jobs',
				loader: () => slow,
			}),
			createRoute({ getParentRoute: () => root, path: '/' }),
			createRoute({
				getParentRoute: () => root,
				path: '/@acme/-/jobs',
				loader: () =>
					query.ensureQueryData({
						queryKey: ['jobs'],
						queryFn: read,
						staleTime: Infinity,
					}),
			}),
			createRoute({
				getParentRoute: () => root,
				path: '/@other/-/jobs',
				loader: () => {
					throw new Error('denied')
				},
			}),
		]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		isServer: false,
		origin,
	})
	const fetcher = vi
		.fn<(slug: string) => Promise<{ ok: boolean }>>()
		.mockResolvedValue({ ok: true })
	const stop = installOrgNavigationCommit(router, fetcher, origin)
	await router.load()
	await router.preloadRoute({ to: '/@acme/-/jobs' })
	expect(read).toHaveBeenCalledTimes(1)
	expect(fetcher).not.toHaveBeenCalled()
	await router.navigate({ href: '/@acme/-/jobs' })
	await Promise.resolve()
	expect(read).toHaveBeenCalledTimes(1)
	expect(fetcher).toHaveBeenCalledTimes(1)
	await router.navigate({ href: '/@other/-/jobs' })
	expect(fetcher).toHaveBeenCalledTimes(1)
	const abandoned = router.navigate({ href: '/@slow/-/jobs' })
	await router.navigate({ href: '/' })
	release()
	await abandoned
	expect(fetcher).toHaveBeenCalledTimes(1)
	stop()
	query.clear()
})

test('hydrated org documents do not repeat their cookie commit for presentation-only navigation', async () => {
	const remember = vi.fn(async (_slug: string) => ({ ok: true }))
	const commit = createOrgNavigationCommit(remember, origin, '/@acme/-/jobs')
	await commit('/@acme/-/jobs?q=example&view=all')
	await commit('/@acme/-/credentials?kind=secret')
	expect(remember).not.toHaveBeenCalled()
	await commit('/@other/-/jobs')
	expect(remember).toHaveBeenCalledExactlyOnceWith('other')
})

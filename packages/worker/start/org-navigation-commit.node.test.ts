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
		.fn<typeof fetch>()
		.mockImplementation(async () => new Response('{}'))
	const commit = createOrgNavigationCommit(fetcher, origin)
	await commit('/account')
	expect(fetcher).not.toHaveBeenCalled()
	await commit('/@acme/-/jobs')
	await commit('/@acme/-/secrets')
	expect(fetcher).toHaveBeenCalledTimes(1)
	expect(fetcher).toHaveBeenCalledWith(
		'/account/last-used-org.json',
		expect.objectContaining({
			referrer: `${origin}/@acme/-/jobs`,
			credentials: 'include',
		}),
	)
	await commit('/@other/-/jobs')
	await commit('/@acme/-/jobs')
	expect(fetcher).toHaveBeenCalledTimes(3)
})

test('rapid org switches serialize cookie responses even when an earlier write is slow', async () => {
	let release!: (response: Response) => void
	const fetcher = vi
		.fn<typeof fetch>()
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = resolve
				}),
		)
		.mockImplementation(async () => new Response('{}'))
	const commit = createOrgNavigationCommit(fetcher, origin)
	const first = commit('/@acme/-/jobs')
	const second = commit('/@other/-/jobs')
	await Promise.resolve()
	expect(fetcher).toHaveBeenCalledTimes(1)
	release(new Response('{}'))
	await Promise.all([first, second])
	expect(fetcher).toHaveBeenCalledTimes(2)
	expect(fetcher.mock.calls[1]?.[1]?.referrer).toBe(`${origin}/@other/-/jobs`)
})

test('a failed cookie commit can be retried without failing navigation', async () => {
	const fetcher = vi
		.fn<typeof fetch>()
		.mockRejectedValueOnce(new Error('offline'))
		.mockImplementation(async () => new Response('{}'))
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
		.fn<typeof fetch>()
		.mockImplementation(async () => new Response('{}'))
	const stop = installOrgNavigationCommit(router, fetcher, origin)
	await router.load()
	await router.preloadRoute({ to: '/@acme/-/jobs' })
	expect(read).toHaveBeenCalledTimes(1)
	expect(fetcher).not.toHaveBeenCalled()
	await router.navigate({ to: '/@acme/-/jobs' })
	await Promise.resolve()
	expect(read).toHaveBeenCalledTimes(1)
	expect(fetcher).toHaveBeenCalledTimes(1)
	await router.navigate({ to: '/@other/-/jobs' })
	expect(fetcher).toHaveBeenCalledTimes(1)
	const abandoned = router.navigate({ to: '/@slow/-/jobs' })
	await router.navigate({ to: '/' })
	release()
	await abandoned
	expect(fetcher).toHaveBeenCalledTimes(1)
	stop()
	query.clear()
})

test('drains each commit response before completing the queued write', async () => {
	const response = new Response('{"ok":true}')
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
	const commit = createOrgNavigationCommit(fetcher, origin)
	await commit('/@acme/-/jobs')
	expect(response.bodyUsed).toBe(true)
})

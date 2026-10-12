import { expect, test } from 'vitest'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	redirect,
	type AnyRoute,
} from '@tanstack/react-router'
import { installNavigationMotion } from './navigation-motion.ts'

function fixture() {
	const root = createRootRoute()
	let releaseSlow!: () => void
	const slow = new Promise<void>((resolve) => {
		releaseSlow = resolve
	})
	const children: AnyRoute[] = [
		'/',
		'/pricing',
		'/docs/one',
		'/docs/two',
		'/account',
		'/account/jobs',
	].map((path) => createRoute({ getParentRoute: () => root, path }))
	children.push(
		createRoute({
			getParentRoute: () => root,
			path: '/slow',
			loader: () => slow,
		}),
	)
	children.push(
		createRoute({
			getParentRoute: () => root,
			path: '/redirect',
			loader: () => {
				throw redirect({ to: '/docs/one' })
			},
		}),
	)
	const router = createRouter({
		routeTree: root.addChildren(children),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		isServer: false,
		origin: 'https://motion.test',
	})
	let reduced = false
	let supported = true
	let marked = 0
	const stop = installNavigationMotion(router, {
		canStart: () => supported,
		prefersReducedMotion: () => reduced,
		hasPersistentShell: () => false,
		markSpaNavigation: () => {
			marked++
		},
	})
	// Mirror Router's mounted history subscription. A history observer alone
	// disables the router's no-subscriber fallback used by headless fixtures.
	const stopHistory = router.history.subscribe(({ action }) => {
		void router.load({ action })
	})
	return {
		router,
		stop: () => {
			stop()
			stopHistory()
		},
		releaseSlow,
		marked: () => marked,
		reduce: () => {
			reduced = true
		},
		unsupported: () => {
			supported = false
		},
	}
}

test('foreground motion policy covers initial load, pages, shell tabs, reduced motion and unsupported browsers', async () => {
	const f = fixture()
	await f.router.load()
	expect(f.marked()).toBe(0)
	expect(f.router.options.defaultViewTransition).toBe(false)
	await f.router.navigate({ to: '/pricing' })
	expect(f.router.options.defaultViewTransition).toBe(true)
	expect(f.marked()).toBe(1)
	await f.router.navigate({ to: '/docs/one' })
	await f.router.navigate({ to: '/docs/two' })
	expect(f.router.options.defaultViewTransition).toBe(false)
	const marks = f.marked()
	await f.router.invalidate()
	expect(f.marked()).toBe(marks)
	f.reduce()
	await f.router.navigate({ to: '/pricing' })
	expect(f.router.options.defaultViewTransition).toBe(false)
	f.unsupported()
	await f.router.navigate({ to: '/' })
	expect(f.router.options.defaultViewTransition).toBe(false)
	f.stop()
})

test('history and redirects recompute policy and mark committed client navigation', async () => {
	const f = fixture()
	await f.router.load()
	await f.router.navigate({ to: '/docs/one' })
	await f.router.navigate({ to: '/docs/two' })
	f.router.history.back()
	await f.router.load()
	expect(f.router.state.location.pathname).toBe('/docs/one')
	expect(f.router.options.defaultViewTransition).toBe(false)
	await f.router.navigate({ to: '/pricing' })
	await f.router.navigate({ to: '/redirect' })
	expect(f.router.state.location.pathname).toBe('/docs/one')
	expect(f.router.options.defaultViewTransition).toBe(true)
	expect(f.marked()).toBeGreaterThan(0)
	f.stop()
})

test('superseded slow navigation never mounts or marks its stale destination', async () => {
	const f = fixture()
	await f.router.load()
	const navigation = f.router.navigate({ to: '/slow' })
	await f.router.navigate({ to: '/docs/one' })
	const marks = f.marked()
	f.releaseSlow()
	await navigation
	expect(f.router.state.location.pathname).toBe('/docs/one')
	expect(f.marked()).toBe(marks)
	expect(f.router.options.defaultViewTransition).toBe(true)
	f.stop()
})

test('history traversal never starts a view transition', async () => {
	const f = fixture()
	await f.router.load()
	await f.router.navigate({ to: '/pricing' })
	expect(f.router.options.defaultViewTransition).toBe(true)
	f.router.history.back()
	await f.router.load()
	expect(f.router.options.defaultViewTransition).toBe(false)
	f.router.history.forward()
	await f.router.load()
	expect(f.router.options.defaultViewTransition).toBe(false)
	await f.router.navigate({ to: '/docs/one' })
	expect(f.router.options.defaultViewTransition).toBe(true)
	f.stop()
})

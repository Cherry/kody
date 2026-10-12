import { expect, test } from 'vitest'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
} from '@tanstack/react-router'

test('blocking root loader sharing does not imply a fresh authority check per navigation', async () => {
	let actor = 'a'
	let hold = false
	let release!: () => void
	const barrier = new Promise<void>((resolve) => {
		release = resolve
	})
	let captured!: () => void
	const started = new Promise<void>((resolve) => {
		captured = resolve
	})
	const reads: string[] = []
	const root = createRootRoute({
		shouldReload: true,
		loader: {
			staleReloadMode: 'blocking',
			handler: async () => {
				const snapshot = actor
				reads.push(snapshot)
				if (hold) {
					captured()
					await barrier
				}
				return { actor: snapshot }
			},
		},
	})
	const router = createRouter({
		routeTree: root.addChildren(
			['/', '/one', '/two'].map((path) =>
				createRoute({ getParentRoute: () => root, path }),
			),
		),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		isServer: false,
		origin: 'https://identity.test',
	})
	await router.load()
	hold = true
	const first = router.navigate({ to: '/one' })
	await started
	actor = 'b'
	const second = router.navigate({ to: '/two' })
	await new Promise((resolve) => setTimeout(resolve, 0))
	release()
	await Promise.all([first, second])
	expect(router.state.location.pathname).toBe('/two')
	expect(reads).toEqual(['a', 'a'])
	expect(router.state.matches[0]?.loaderData).toEqual({ actor: 'a' })
})

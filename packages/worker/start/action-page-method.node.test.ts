import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen.ts'
import {
	isServerFunctionRequest,
	rejectActionPageHead,
} from './action-page-method.ts'
import { verifyEmailDestinationHead } from '#start/server/action-page-http'
import { actionPagePaths } from './action-pages.ts'

const router = createRouter({
	routeTree,
	history: createMemoryHistory(),
	context: { queryClient: new QueryClient(), getCommittedPage: () => null },
})

test('native HEAD handlers prevent token and billing document loaders from running', async () => {
	for (const pathname of [...actionPagePaths, '/@example/-/billing/success']) {
		const [, , route] = router.getMatchedRoutes(pathname)
		assert.ok(route)
		assert.equal(route.options.preload, false)
		const handlers = route.options.server?.handlers
		assert.ok(handlers && typeof handlers === 'object')
		if (pathname === '/verify-email-destination') {
			assert.equal(handlers.HEAD, verifyEmailDestinationHead)
			continue
		}
		assert.equal(handlers.HEAD, rejectActionPageHead)
		// This handler returns a response directly, without calling next or a loader.
		const response = await rejectActionPageHead()
		assert.equal(response.status, 405)
		assert.equal(response.headers.get('Allow'), 'GET')
		assert.equal(await response.text(), '')
		assert.equal(handlers.GET, undefined)
	}
})

test('native RPC detection does not depend on the token-page URL inventory', () => {
	vi.stubEnv('TSS_SERVER_FN_BASE', '/_serverFn/')
	try {
		assert.equal(
			isServerFunctionRequest(
				new Request('https://kody.test/_serverFn/example', { method: 'POST' }),
			),
			true,
		)
		assert.equal(
			isServerFunctionRequest(new Request('https://kody.test/verify-email')),
			false,
		)
	} finally {
		vi.unstubAllEnvs()
	}
})

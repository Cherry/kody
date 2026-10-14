import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { dispatchDocumentMethod } from './action-page-method.ts'
import { actionPagePaths } from './action-pages.ts'

test('HEAD never executes a token-consuming page loader', async () => {
	for (const pathname of actionPagePaths) {
		if (pathname === '/verify-email-destination') continue
		let calls = 0
		const response = await dispatchDocumentMethod({
			request: new Request(`https://kody.test${pathname}?token=example`, {
				method: 'HEAD',
			}),
			readDestinationHead: async () => {
				calls++
				return new Response()
			},
			render: async () => {
				calls++
				return new Response()
			},
		})
		assert.equal(response.status, 405)
		assert.equal(response.headers.get('Allow'), 'GET')
		assert.equal(calls, 0)
	}
})
test('destination HEAD uses only its existing read-only verifier', async () => {
	let renders = 0
	const response = await dispatchDocumentMethod({
		request: new Request(
			'https://kody.test/verify-email-destination?token=invalid',
			{ method: 'HEAD' },
		),
		readDestinationHead: async () => new Response(null, { status: 400 }),
		render: async () => {
			renders++
			return new Response()
		},
	})
	assert.equal(response.status, 400)
	assert.equal(renders, 0)
})
test('GET retains the native page loader', async () => {
	let renders = 0
	const response = await dispatchDocumentMethod({
		request: new Request('https://kody.test/verify-email'),
		readDestinationHead: async () => {
			throw new Error('unexpected verifier')
		},
		render: async () => {
			renders++
			return new Response('verified')
		},
	})
	assert.equal(await response.text(), 'verified')
	assert.equal(renders, 1)
})

test('native RPC bypasses token-page HEAD restrictions', async () => {
	vi.stubEnv('TSS_SERVER_FN_BASE', '/_serverFn/')
	try {
		let calls = 0
		const response = await dispatchDocumentMethod({
			request: new Request('https://kody.test/_serverFn/example', {
				method: 'POST',
			}),
			readDestinationHead: async () => {
				throw new Error('Unexpected verifier')
			},
			render: async () => {
				calls++
				return new Response('RPC')
			},
		})
		assert.equal(response.status, 200)
		assert.equal(calls, 1)
	} finally {
		vi.unstubAllEnvs()
	}
})

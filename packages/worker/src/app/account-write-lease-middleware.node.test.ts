import { ownerIdFromStored } from '@kody-internal/shared/owner-person-ids.ts'
import { expect, test, vi } from 'vitest'
import { createInMemoryUserMeterEnv } from '#worker/test-support/user-meter.ts'
import { userMeterRpc } from '#worker/entitlements/user-meter-client.ts'

const authMock = vi.hoisted(() => ({
	loadResolvedRequestAuth: vi.fn(),
}))

vi.mock('./request-auth-cache.ts', () => ({
	loadResolvedRequestAuth: authMock.loadResolvedRequestAuth,
}))

const { withProtocolAccountWriteLease } =
	await import('./account-write-lease-middleware.ts')

test('authenticated delayed mutation holds web lease through handler completion', async () => {
	authMock.loadResolvedRequestAuth.mockResolvedValue({
		sessionUserId: '1',
		user: {
			accountDeleting: false,
			mcpUser: { userId: ownerIdFromStored('user-a') },
		},
	})
	const meter = createInMemoryUserMeterEnv()
	const meterA = userMeterRpc({
		env: meter.env,
		userId: ownerIdFromStored('user-a'),
	})
	const db = {
		prepare(query: string) {
			return {
				bind() {
					return {
						async first() {
							if (query.includes('deleting_at')) {
								return { deleting_at: null }
							}
							return null
						},
						async run() {
							return { meta: { changes: 1 } }
						},
						async all() {
							return { results: [], meta: { changes: 0 } }
						},
					}
				},
			}
		},
		async batch() {
			return []
		},
	} as unknown as D1Database
	let startHandler: () => void = () => undefined
	let finishHandler: () => void = () => undefined
	const started = new Promise<void>((resolve) => {
		startHandler = resolve
	})
	const finish = new Promise<void>((resolve) => {
		finishHandler = resolve
	})
	const responsePromise = withProtocolAccountWriteLease(
		new Request('https://example.com/auth', { method: 'POST' }),
		{
			APP_DB: db,
			USER_METER: meter.env.USER_METER,
		} as Env,
		async () => {
			expect(await meterA.countActiveWriteLeases()).toEqual({ count: 1 })
			startHandler()
			await finish
			return Response.json({ ok: true })
		},
	)
	await started
	expect(await meterA.countActiveWriteLeases()).toEqual({ count: 1 })
	finishHandler()
	await expect(responsePromise).resolves.toMatchObject({ status: 200 })
	expect(await meterA.countActiveWriteLeases()).toEqual({ count: 0 })
})

test('logout is not blocked while an account is deleting', async () => {
	authMock.loadResolvedRequestAuth.mockResolvedValue({
		sessionUserId: '1',
		user: {
			accountDeleting: true,
			mcpUser: { userId: ownerIdFromStored('user-a') },
		},
	})
	const next = vi.fn(async () => new Response(null, { status: 302 }))
	const response = await withProtocolAccountWriteLease(
		new Request('https://example.com/logout', { method: 'POST' }),
		{} as Env,
		next,
	)
	expect(next).toHaveBeenCalledOnce()
	expect(response.status).toBe(302)
})

test('nonmutating documents preserve the native middleware result without auth or a lease', async () => {
	authMock.loadResolvedRequestAuth.mockClear()
	const result = {
		response: new Response('document'),
		context: { requestId: 'request-1' },
	}
	expect(
		await withProtocolAccountWriteLease(
			new Request('https://example.com/docs'),
			{} as Env,
			async () => result,
		),
	).toBe(result)
	expect(authMock.loadResolvedRequestAuth).not.toHaveBeenCalled()
})

test.each([
	['POST', '/auth'],
	['GET', '/account/mcp-servers/oauth/callback'],
	['GET', '/@acme/-/billing/success'],
	['GET', '/@acme/-/billing/portal'],
])(
	'deleting accounts cannot enter mutating protocol %s %s',
	async (method, path) => {
		authMock.loadResolvedRequestAuth.mockResolvedValue({
			user: {
				accountDeleting: true,
				mcpUser: { userId: ownerIdFromStored('user-a') },
			},
		})
		const next = vi.fn(async () => ({ response: new Response('unsafe') }))
		const result = await withProtocolAccountWriteLease(
			new Request(`https://example.com${path}`, { method }),
			{} as Env,
			next,
		)
		expect(result).toBeInstanceOf(Response)
		if (!(result instanceof Response))
			throw new Error('Expected an account deletion denial')
		expect(result.status).toBe(409)
		expect(await result.json()).toMatchObject({
			error: { code: 'account_deleting' },
		})
		expect(next).not.toHaveBeenCalled()
	},
)

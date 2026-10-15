import {
	ownerIdFromStored,
	personIdFromStored,
} from '@kody-internal/shared/owner-person-ids.ts'
import { expect, test, vi } from 'vitest'
import type * as authenticatedUserModule from '#app/authenticated-user.ts'
import type * as valuesService from '#mcp/values/service.ts'
import { sessionRequestContext } from '#worker/test-support/request-context.ts'

const mockModule = vi.hoisted(() => ({
	readAuthenticatedAppUser: vi.fn<
		typeof authenticatedUserModule.readAuthenticatedAppUser
	>(async () => ({
		sessionUserId: '42',
		userId: 42,
		username: 'test-user',
		email: 'user@example.com',
		emailVerified: true,
		emailVerificationDelivery: null,
		displayName: 'user',
		roles: ['user'],
		permissions: [],
		artifactOwnerIds: [],
		mcpUser: {
			userId: personIdFromStored('stable-user-1'),
			email: 'user@example.com',
			username: 'test-user',
			displayName: 'user',
		},
		request: sessionRequestContext('stable-user-1'),
	})),
	readAuthSessionResult: async () => ({ session: null, setCookie: null }),
	listValues: vi.fn<typeof valuesService.listValues>(async () => [
		{
			name: 'theme',
			scope: 'user' as const,
			value: 'dark',
			description: 'UI theme preference',
			appId: null,
			createdAt: new Date(0).toISOString(),
			updatedAt: new Date(0).toISOString(),
			ttlMs: null,
		},
		{
			name: '_scratch:notes',
			scope: 'user' as const,
			value: 'todo',
			description: 'Scratch notes',
			appId: null,
			createdAt: new Date(0).toISOString(),
			updatedAt: new Date(0).toISOString(),
			ttlMs: null,
		},
	]),
	getValue: vi.fn<typeof valuesService.getValue>(async () => null),
	deleteValue: vi.fn<typeof valuesService.deleteValue>(async () => true),
}))

vi.mock('#app/authenticated-user.ts', () => ({
	readAuthenticatedAppUser: (
		...args: Parameters<typeof authenticatedUserModule.readAuthenticatedAppUser>
	) => mockModule.readAuthenticatedAppUser(...args),
}))

vi.mock('#app/auth-session.ts', () => ({
	readAuthSessionResult: () => mockModule.readAuthSessionResult(),
}))

vi.mock('#app/auth-redirect.ts', () => ({
	redirectToLogin: () => new Response(null, { status: 302 }),
}))

vi.mock('#mcp/values/service.ts', () => ({
	listValues: (...args: Parameters<typeof valuesService.listValues>) =>
		mockModule.listValues(...args),
	getValue: (...args: Parameters<typeof valuesService.getValue>) =>
		mockModule.getValue(...args),
	deleteValue: (...args: Parameters<typeof valuesService.deleteValue>) =>
		mockModule.deleteValue(...args),
}))

const { testAccountValuesApiHandler } =
	await import('./account-values.test-support.ts')

const valuesUrl = 'https://example.com/account/values.json'

function createValuesClient() {
	const { execute } = testAccountValuesApiHandler({
		APP_DB: {} as D1Database,
	} as Env)
	return {
		get: (search = '') => execute({ request: new Request(valuesUrl + search) }),
		post: (body: Record<string, unknown>) =>
			execute({
				request: new Request(valuesUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				}),
			}),
	}
}

test('values API lists, selects, and deletes leftover user-scoped rows', async () => {
	const { get, post } = createValuesClient()

	const listResponse = await get()
	expect(listResponse.status).toBe(200)
	expect(listResponse.data).toEqual({
		ok: true,
		values: [
			{
				id: 'theme',
				name: 'theme',
				description: 'UI theme preference',
				valuePreview: 'dark',
				updatedAt: new Date(0).toISOString(),
				ttlMs: null,
			},
			{
				id: '_scratch:notes',
				name: '_scratch:notes',
				description: 'Scratch notes',
				valuePreview: 'todo',
				updatedAt: new Date(0).toISOString(),
				ttlMs: null,
			},
		],
		selectedValue: null,
		selectedValueId: null,
	})
	expect(mockModule.listValues).toHaveBeenCalledWith(
		expect.objectContaining({
			userId: ownerIdFromStored('stable-user-1'),
			scope: 'user',
			storageContext: { sessionId: null, appId: null },
		}),
	)

	const selectedResponse = await get('?selected=theme')
	expect(selectedResponse.status).toBe(200)
	expect(selectedResponse.data).toMatchObject({
		ok: true,
		selectedValueId: 'theme',
		selectedValue: expect.objectContaining({
			id: 'theme',
			name: 'theme',
			value: 'dark',
		}),
	})

	mockModule.listValues.mockResolvedValueOnce([])
	const deleteResponse = await post({ action: 'delete', name: 'theme' })
	expect(deleteResponse.status).toBe(200)
	expect(mockModule.deleteValue).toHaveBeenCalledWith(
		expect.objectContaining({
			userId: ownerIdFromStored('stable-user-1'),
			scope: 'user',
			name: 'theme',
		}),
	)
	expect(deleteResponse.data).toEqual({
		ok: true,
		values: [],
		selectedValue: null,
		selectedValueId: null,
	})
})

test('values API rejects save, missing deletes, invalid actions, and unauthenticated requests', async () => {
	const { get, post } = createValuesClient()

	const rejections = [
		[
			{ action: 'save', name: 'locale', value: 'en-US' },
			400,
			{ ok: false, error: 'Invalid action.' },
		],
		[{ action: 'delete', name: 'missing' }, 404, { ok: false }],
		[{ action: 'nope' }, 400, { ok: false }],
	] as const
	for (const [body, status, want] of rejections) {
		if (status === 404) mockModule.deleteValue.mockResolvedValueOnce(false)
		const response = await post(body)
		expect([body, response.status, response.data]).toEqual([
			body,
			status,
			expect.objectContaining(want),
		])
	}

	mockModule.readAuthenticatedAppUser.mockResolvedValueOnce(null)
	expect((await get()).status).toBe(401)
})

test('accepted value deletion does not depend on listing values', async () => {
	const { post } = createValuesClient()
	const original = mockModule.listValues.getMockImplementation()
	mockModule.listValues.mockRejectedValue(new Error('Page unavailable'))
	mockModule.listValues.mockClear()
	mockModule.deleteValue.mockResolvedValueOnce(true)
	try {
		const response = await post({ action: 'delete', name: 'theme' })
		expect(response.status).toBe(200)
		expect(response.data).toEqual({ ok: true, deletedName: 'theme' })
		expect(mockModule.listValues).not.toHaveBeenCalled()
	} finally {
		mockModule.listValues.mockImplementation(original!)
	}
})

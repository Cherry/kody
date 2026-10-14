import { ownerIdFromStored } from '@kody-internal/shared/owner-person-ids.ts'
import { expect, test, vi } from 'vitest'
import type * as EmailDestinations from '#worker/email/destinations.ts'
import {
	loadEmailList,
	loadEmailDestinations,
} from '../../../start/server/email.ts'
import { loadAccountEmailData } from '#app/account-email-data.ts'
import {
	listEmailNotificationDestinations,
	maxAdditionalEmailNotificationDestinations,
} from '#worker/email/destinations.ts'
import { identityEmailDestinationId } from '#universal/email-destinations.ts'

const state = vi.hoisted(() => ({ collection: vi.fn() }))
vi.mock('../../../start/server/account-collections.ts', () => ({
	loadCollection: state.collection,
}))

vi.mock('#app/account-email-data.ts', () => ({
	loadAccountEmailData: vi.fn(),
}))

vi.mock('#worker/email/destinations.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof EmailDestinations>()
	return {
		...actual,
		listEmailNotificationDestinations: vi.fn(),
	}
})

vi.mock('@tanstack/react-start', async () => ({
	createServerFn: (
		await import('#worker/test-support/start-server-function.ts')
	).createTestServerFn,
	createServerOnlyFn: <T>(fn: T) => fn,
}))
test('email server resources return independent message lists and actor destinations', async () => {
	const user = {
		sessionUserId: '42',
		userId: 42,
		username: 'test-user',
		email: 'user@example.com',
		emailVerified: true,
		displayName: 'user',
		roles: ['user'],
		permissions: [],
		artifactOwnerIds: [],
		mcpUser: {
			userId: ownerIdFromStored('stable-user-1'),
			email: 'user@example.com',
			username: 'test-user',
			displayName: 'user',
		},
	}
	state.collection.mockImplementation(async (href: string) => ({
		bindings: { APP_DB: {} },
		request: new Request(new URL(href, 'https://example.com')),
		user,
	}))
	vi.mocked(loadAccountEmailData).mockResolvedValue({
		ok: true,
		emailVerified: true,
		email: 'user@example.com',
		username: 'test-user',
		inboxAddress: 'test-user@inbox.example.com',
		verificationMessage: null,
		inboxes: [],
		messages: [],
		selectedMessage: null,
		usage: null,
		page: 1,
		pageSize: 25,
		total: 0,
		query: '',
		classification: null,
	})
	vi.mocked(listEmailNotificationDestinations).mockResolvedValue([
		{
			id: identityEmailDestinationId,
			email: 'user@example.com',
			kind: 'identity',
			verified: true,
			isDefault: true,
			canRemove: false,
		},
	])

	const [payload, destinations] = await Promise.all([
		loadEmailList({
			data: {
				org: null,
				query: '',
				classification: null,
				page: 1,
				pageSize: 25,
			},
		}),
		loadEmailDestinations(),
	])
	expect(state.collection).toHaveBeenCalledWith(
		'/account/email?q=&page=1&pageSize=25',
	)
	expect(state.collection).toHaveBeenCalledWith('/account/email')
	expect(listEmailNotificationDestinations).toHaveBeenCalledWith(
		expect.objectContaining({
			dbUserId: 42,
			accountEmail: 'user@example.com',
			accountEmailVerified: true,
		}),
	)
	const response = { payload, destinations }
	expect(response.payload).not.toHaveProperty('selectedMessage')
	expect(response).toMatchObject({
		payload: expect.objectContaining({
			ok: true,
			email: 'user@example.com',
		}),
		destinations: {
			ok: true,
			destinations: [
				expect.objectContaining({
					id: identityEmailDestinationId,
					email: 'user@example.com',
				}),
			],
			additionalLimit: maxAdditionalEmailNotificationDestinations,
			additionalRemaining: maxAdditionalEmailNotificationDestinations,
		},
	})
})

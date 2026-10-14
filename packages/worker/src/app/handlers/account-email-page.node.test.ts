import type * as CloudflareWorkers from 'cloudflare:workers'
import { ownerIdFromStored } from '@kody-internal/shared/owner-person-ids.ts'
import { expect, test, vi } from 'vitest'
import type * as EmailDestinations from '#worker/email/destinations.ts'
import { loadEmailPage } from '../../../start/server/account-collections.ts'
import { loadAccountEmailData } from '#app/account-email-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import {
	listEmailNotificationDestinations,
	maxAdditionalEmailNotificationDestinations,
} from '#worker/email/destinations.ts'
import { identityEmailDestinationId } from '#universal/email-destinations.ts'

vi.mock('#app/page-auth.ts', () => ({
	requireAuthenticatedPageUser: vi.fn(),
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
vi.mock('cloudflare:workers', async (importOriginal) => ({
	...(await importOriginal<typeof CloudflareWorkers>()),
	env: { APP_DB: {}, COOKIE_SECRET: 'test' },
}))
vi.mock('@tanstack/react-start/server', () => ({
	getRequest: () => new Request('https://example.com/_serverFn/email'),
	setResponseHeader: vi.fn(),
}))
vi.mock('#app/env.ts', () => ({ getEnv: (env: unknown) => env }))
vi.mock('#app/auth-session.ts', () => ({ setAuthSessionSecret: vi.fn() }))
vi.mock('#app/org-request-binding.ts', () => ({
	isOrgRequestDenied: async () => false,
}))

test('email inbox SSR includes destinations and not just the message list', async () => {
	vi.mocked(requireAuthenticatedPageUser).mockResolvedValue({
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
	} as never)
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

	const response = await loadEmailPage({ data: '/account/email' })
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

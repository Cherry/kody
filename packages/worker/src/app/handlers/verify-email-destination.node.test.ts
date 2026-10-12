import { expect, test, vi } from 'vitest'
import { loadVerifyEmailDestinationPage } from '#app/handlers/verify-email-destination.ts'
import { verifyEmailDestinationToken } from '#worker/email/destination-verification.ts'

vi.mock('#worker/email/destination-verification.ts', () => ({
	verifyEmailDestinationToken: vi.fn(),
}))

vi.mock('#worker/audit-log.ts', () => ({
	auditDatabaseFromEnv: vi.fn(),
	getRequestIp: vi.fn(() => null),
	logAuditEvent: vi.fn(),
}))

test('verified destination CTA returns to the email inbox destinations panel', async () => {
	vi.mocked(verifyEmailDestinationToken).mockResolvedValue({
		ok: true,
		userId: 1,
		email: 'pager@example.com',
	})
	const env = {
		APP_DB: {} as D1Database,
	} as Env

	const response = await loadVerifyEmailDestinationPage(
		new Request('https://example.com/verify-email-destination?token=ok'),
		env,
	)

	expect(response).toMatchObject({
		loaderData: {
			emailVerification: {
				ok: true,
				kind: 'email_destination',
				ctaHref: '/account/email#email-destinations',
			},
		},
	})
})

test('destination verify HEAD peeks without consuming and failures offer a resend path', async () => {
	vi.mocked(verifyEmailDestinationToken).mockResolvedValue({
		ok: true,
		userId: 1,
		email: 'pager@example.com',
	})
	const env = {
		APP_DB: {} as D1Database,
	} as Env

	const head = await loadVerifyEmailDestinationPage(
		new Request('https://example.com/verify-email-destination?token=ok', {
			method: 'HEAD',
		}),
		env,
	)
	expect(head).toBeInstanceOf(Response)
	if (!(head instanceof Response)) throw new Error('Expected HEAD response')
	expect(head.status).toBe(200)
	expect(await head.text()).toBe('')
	expect(verifyEmailDestinationToken).toHaveBeenCalledWith({
		db: expect.anything(),
		token: 'ok',
		consume: false,
	})

	vi.mocked(verifyEmailDestinationToken).mockResolvedValue({
		ok: false,
		reason: 'invalid_token',
	})
	const failed = await loadVerifyEmailDestinationPage(
		new Request('https://example.com/verify-email-destination?token=nope'),
		env,
	)
	expect(failed).toMatchObject({
		loaderData: {
			emailVerification: {
				ok: false,
				kind: 'email_destination',
				reason: 'invalid_token',
				ctaHref: '/account/email#email-destinations',
			},
		},
	})
})

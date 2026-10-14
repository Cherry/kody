import { expect, test, vi } from 'vitest'
import { verifyEmailDestinationHead } from './action-page-http.ts'

const { verifyToken, auditEvent, bindings } = vi.hoisted(() => ({
	verifyToken: vi.fn(),
	auditEvent: vi.fn(),
	bindings: { APP_DB: {} },
}))
vi.mock('cloudflare:workers', () => ({ env: bindings }))
vi.mock('../../src/app/env.ts', () => ({ getEnv: () => bindings }))
vi.mock('../../src/email/destination-verification.ts', () => ({
	verifyEmailDestinationToken: verifyToken,
}))
vi.mock('../../src/audit-log.ts', () => ({
	auditDatabaseFromEnv: vi.fn(),
	getRequestIp: vi.fn(() => null),
	logAuditEvent: auditEvent,
}))

test.each([
	[{ ok: true, userId: 1, email: 'pager@example.com' }, 200],
	[{ ok: false, reason: 'invalid_token' }, 400],
] as const)(
	'native destination HEAD checks without consuming or auditing (%s)',
	async (result, status) => {
		vi.clearAllMocks()
		verifyToken.mockResolvedValue(result)
		const response = await verifyEmailDestinationHead({
			request: new Request(
				'https://kody.test/verify-email-destination?token=example',
				{ method: 'HEAD' },
			),
		})
		expect(response.status).toBe(status)
		expect(await response.text()).toBe('')
		expect(verifyToken).toHaveBeenCalledExactlyOnceWith({
			db: bindings.APP_DB,
			token: 'example',
			consume: false,
		})
		expect(auditEvent).not.toHaveBeenCalled()
	},
)

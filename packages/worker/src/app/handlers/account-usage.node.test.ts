import { sessionRequestContext } from '#worker/test-support/request-context.ts'
import { personIdFromStored } from '@kody-internal/shared/owner-person-ids.ts'
import { beforeEach, expect, test, vi } from 'vitest'
import type * as CreditTopUps from '#worker/billing/credit-top-ups.ts'
import { CreditTopUpError } from '#worker/billing/credit-top-ups.ts'
import { consoleError } from '#worker/test-support/console-spies.ts'
import { loadAccountUsagePageResult } from '../account-usage-page.ts'

const mockModule = vi.hoisted(() => ({
	loadAccountUsageData: vi.fn<(input: unknown) => Promise<unknown>>(),
	applyCreditTopUpFromCheckoutSession:
		vi.fn<(input: unknown) => Promise<unknown>>(),
}))

vi.mock('#app/account-usage-data.ts', () => ({
	loadAccountUsageData: (input: unknown) =>
		mockModule.loadAccountUsageData(input),
}))

vi.mock('#worker/billing/credit-top-ups.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof CreditTopUps>()
	return {
		...actual,
		applyCreditTopUpFromCheckoutSession: (input: unknown) =>
			mockModule.applyCreditTopUpFromCheckoutSession(input),
	}
})

const env = {} as Env

beforeEach(() => {
	vi.clearAllMocks()
	mockModule.loadAccountUsageData.mockResolvedValue({ ok: true })
})

async function getUsage(search: string) {
	const request = new Request(`https://kody.codes/account/usage${search}`)
	return loadAccountUsagePageResult(env, request, {
		sessionUserId: '7',
		userId: 7,
		username: 'usage-user',
		email: 'usage@example.com',
		emailVerified: true,
		emailVerificationDelivery: null,
		displayName: 'Usage',
		roles: ['user'],
		permissions: [],
		artifactOwnerIds: [],
		request: sessionRequestContext('stable-7'),
		mcpUser: {
			userId: personIdFromStored('stable-7'),
			email: 'usage@example.com',
			username: 'usage-user',
			displayName: 'Usage',
		},
	})
}

test('a confirmed Stripe return lands on the Credits section with the added notice', async () => {
	const response = await getUsage('?topup=success&session_id=cs_123')
	expect(mockModule.applyCreditTopUpFromCheckoutSession).toHaveBeenCalledWith(
		expect.objectContaining({
			sessionId: 'cs_123',
			expectedStableUserId: 'stable-7',
		}),
	)
	expect(response).toBeInstanceOf(Response)
	if (!(response instanceof Response))
		throw new Error('Expected billing redirect')
	expect(response.status).toBe(302)
	expect(response.headers.get('Location')).toBe(
		'https://kody.codes/account/usage?credits=added#credits',
	)
})

test('a rejected Stripe return keeps known codes and folds the rest into topup_failed', async () => {
	consoleError.mockImplementation(() => {})
	mockModule.applyCreditTopUpFromCheckoutSession.mockRejectedValueOnce(
		new CreditTopUpError('not_paid', 'Not paid.'),
	)
	const notPaid = await getUsage('?topup=success&session_id=cs_1')
	if (!(notPaid instanceof Response))
		throw new Error('Expected billing redirect')
	expect(notPaid.headers.get('Location')).toBe(
		'https://kody.codes/account/usage?error=not_paid#credits',
	)

	mockModule.applyCreditTopUpFromCheckoutSession.mockRejectedValueOnce(
		new CreditTopUpError('user_not_found', 'Missing.'),
	)
	const unknown = await getUsage('?topup=success&session_id=cs_2')
	if (!(unknown instanceof Response))
		throw new Error('Expected billing redirect')
	expect(unknown.headers.get('Location')).toBe(
		'https://kody.codes/account/usage?error=topup_failed#credits',
	)
	expect(consoleError.mock.calls.map(([message]) => message)).toEqual([
		'credit_top_up_confirm_failed',
		'credit_top_up_confirm_failed',
	])
})

test('notice and error codes map to messages; unknown and prototype keys map to nothing', async () => {
	await getUsage('?credits=added&error=not_paid')
	expect(mockModule.loadAccountUsageData).toHaveBeenLastCalledWith(
		expect.objectContaining({
			notice: expect.any(String),
			error: expect.any(String),
		}),
	)

	await getUsage('?credits=__proto__&error=constructor')
	expect(mockModule.loadAccountUsageData).toHaveBeenLastCalledWith(
		expect.objectContaining({ notice: undefined, error: undefined }),
	)
	expect(mockModule.applyCreditTopUpFromCheckoutSession).not.toHaveBeenCalled()
})

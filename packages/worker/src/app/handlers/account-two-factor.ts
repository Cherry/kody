import { type AuthenticatedAppUser } from '#app/authenticated-user.ts'
import {
	cancelTwoFactorSetup,
	confirmTwoFactorSetup,
	createTwoFactorSetup,
	disableTwoFactor,
	findTwoFactorVerification,
	isTwoFactorEnabled,
	twoFactorSetupVerificationType,
	twoFactorVerificationType,
	verifyTwoFactorCode,
} from '#app/two-factor.ts'
import { type AccountTwoFactorLoaderData } from '#universal/loader-data.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import { enum_, object, optional, parseSafe, string } from 'remix/data-schema'

const twoFactorActionSchema = object({
	intent: enum_(['setup', 'confirm', 'cancel', 'disable'] as const),
	code: optional(string()),
})

export async function loadTwoFactorStatus(
	db: D1Database,
	userId: number,
): Promise<AccountTwoFactorLoaderData> {
	return {
		ok: true,
		enabled: await isTwoFactorEnabled(db, userId),
	}
}

export async function mutateTwoFactor({
	env,
	request,
	user,
	body,
}: {
	env: Env
	request: Request
	user: AuthenticatedAppUser
	body: unknown
}) {
	const url = new URL(request.url)
	const parsed = parseSafe(twoFactorActionSchema, body)
	if (!parsed.success) {
		return { ok: false, error: 'Invalid request body.' }
	}

	const requestIp = getRequestIp(request) ?? undefined
	const intent = parsed.value.intent
	const code = parsed.value.code?.trim() ?? ''

	switch (intent) {
		case 'setup': {
			// A hijacked session must not be able to swap out the active
			// factor: re-enrollment requires disabling first, which demands
			// a current code.
			if (await isTwoFactorEnabled(env.APP_DB, user.userId)) {
				return {
					ok: false,
					error:
						'Two-factor authentication is already enabled. Disable it first to set up a new authenticator.',
				}
			}
			const { otpUri, secret } = await createTwoFactorSetup({
				db: env.APP_DB,
				userId: user.userId,
				accountName: user.email,
				issuer: url.hostname,
			})
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'account',
				action: 'two_factor_setup_start',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: url.pathname,
			})
			return { ok: true, otpUri, secret }
		}
		case 'confirm': {
			if (!code) {
				return { ok: false, error: 'Verification code is required.' }
			}
			// A stale pending row must never replace an already-active
			// factor (same reasoning as the setup guard).
			if (await isTwoFactorEnabled(env.APP_DB, user.userId)) {
				return {
					ok: false,
					error: 'Two-factor authentication is already enabled.',
				}
			}
			const pendingSetup = await findTwoFactorVerification(
				env.APP_DB,
				user.userId,
				twoFactorSetupVerificationType,
			)
			if (!pendingSetup) {
				return { ok: false, error: 'No two-factor setup is in progress.' }
			}
			const codeValid = await verifyTwoFactorCode({
				db: env.APP_DB,
				userId: user.userId,
				code,
				type: twoFactorSetupVerificationType,
			})
			if (!codeValid) {
				void logAuditEvent({
					db: auditDatabaseFromEnv(env),
					category: 'account',
					action: 'two_factor_enable',
					result: 'failure',
					email: user.email,
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_code',
				})
				return { ok: false, error: 'Invalid code.' }
			}
			const promoted = await confirmTwoFactorSetup(env.APP_DB, user.userId)
			if (!promoted) {
				return { ok: false, error: 'No two-factor setup is in progress.' }
			}
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'account',
				action: 'two_factor_enable',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: url.pathname,
			})
			return await loadTwoFactorStatus(env.APP_DB, user.userId)
		}
		case 'cancel': {
			await cancelTwoFactorSetup(env.APP_DB, user.userId)
			return await loadTwoFactorStatus(env.APP_DB, user.userId)
		}
		case 'disable': {
			// Disabling weakens account security, so require a fresh code
			// from the active authenticator (Epic Stack requires recent
			// re-verification; an inline code is the stateless equivalent).
			if (!code) {
				return { ok: false, error: 'Verification code is required.' }
			}
			const codeValid = await verifyTwoFactorCode({
				db: env.APP_DB,
				userId: user.userId,
				code,
				type: twoFactorVerificationType,
			})
			if (!codeValid) {
				void logAuditEvent({
					db: auditDatabaseFromEnv(env),
					category: 'account',
					action: 'two_factor_disable',
					result: 'failure',
					email: user.email,
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_code',
				})
				return { ok: false, error: 'Invalid code.' }
			}
			await disableTwoFactor(env.APP_DB, user.userId)
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'account',
				action: 'two_factor_disable',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: url.pathname,
			})
			return await loadTwoFactorStatus(env.APP_DB, user.userId)
		}
		default: {
			intent satisfies never
			return { ok: false, error: 'Unknown intent.' }
		}
	}
}

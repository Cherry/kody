import { type AppPageResult } from '#app/page-result.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import { verifyEmailToken } from '#app/email-verification.ts'
import { scheduleKitSubscriberSync } from '#worker/kit/subscriber-sync.ts'
import { sendConnectAgentEmail } from '#app/user-account-emails.ts'
import { resolveVerifyEmailSuccessCta } from '#universal/safe-redirect.ts'
import { waitUntil } from 'cloudflare:workers'
import { maybeRewardHeldReferralAfterEmailVerified } from '#worker/entitlements/referral-program.ts'
import { latestReferrerPaidPeriodEnd } from '#worker/billing/stripe-webhooks.ts'
import { recordOnboardingFunnelEvent } from '#worker/identity/onboarding-funnel.ts'

function getVerifyEmailError(
	reason: 'missing_token' | 'invalid_token' | 'expired_token',
) {
	switch (reason) {
		case 'missing_token':
			return 'Verification token is required.'
		case 'invalid_token':
			return 'Verification link is invalid.'
		case 'expired_token':
			return 'Verification link has expired.'
		default: {
			const unreachable: never = reason
			return unreachable
		}
	}
}

export async function loadVerifyEmailPage(
	request: Request,
	env: Env,
): Promise<AppPageResult> {
	const url = new URL(request.url)
	const result = await verifyEmailToken({
		db: env.APP_DB,
		token: url.searchParams.get('token'),
	})
	const requestIp = getRequestIp(request) ?? undefined

	if (!result.ok) {
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'auth',
			action: 'email_verify',
			result: 'failure',
			ip: requestIp,
			path: url.pathname,
			reason: result.reason,
		})
		return {
			title: 'Verify email',
			status: 400,
			loaderData: {
				emailVerification: {
					ok: false,
					error: getVerifyEmailError(result.reason),
				},
			},
		}
	}

	void logAuditEvent({
		db: auditDatabaseFromEnv(env),
		category: 'auth',
		action: 'email_verify',
		result: 'success',
		email: result.email,
		ip: requestIp,
		path: url.pathname,
	})
	if (result.newlyVerified) {
		recordOnboardingFunnelEvent(env, {
			stage: 'email_verified',
			userId: result.stableUserId,
		})
	}
	if (result.newlyVerified) {
		waitUntil(
			sendConnectAgentEmail({
				env,
				email: result.email,
				userId: result.stableUserId,
				requestUrl: request.url,
			}).catch((error) => {
				console.warn('connect-agent-email-failed', error)
			}),
		)
		scheduleKitSubscriberSync({
			env,
			email: result.email,
			stableUserId: result.stableUserId,
		})
		waitUntil(
			maybeRewardHeldReferralAfterEmailVerified({
				db: env.APP_DB,
				stableUserId: result.stableUserId,
				resolveReferrerPaidPeriodEnd: (referrerStableUserId) =>
					latestReferrerPaidPeriodEnd({
						env,
						referrerStableUserId,
					}),
			}).catch((error) => {
				console.warn('referral-held-reward-failed', error)
			}),
		)
	}
	const cta = resolveVerifyEmailSuccessCta(url.searchParams.get('redirectTo'))
	return {
		title: 'Email verified',
		loaderData: {
			emailVerification: {
				ok: true,
				kind: 'email_verify',
				message: cta.message,
				ctaHref: cta.href,
				ctaLabel: cta.label,
			},
		},
	}
}

import { type AppPageResult } from '#app/page-result.ts'
import { type Action } from 'remix/router'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import { verifyEmailClaimReleaseToken } from '#app/email-claim-release.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'

function getVerifyEmailClaimReleaseError(
	reason:
		| 'missing_token'
		| 'invalid_token'
		| 'expired_token'
		| 'not_claimed'
		| 'current_email'
		| 'daily_cap',
) {
	switch (reason) {
		case 'missing_token':
			return 'Verification token is required.'
		case 'invalid_token':
			return 'Release link is invalid.'
		case 'expired_token':
			return 'Release link has expired.'
		case 'not_claimed':
			return 'That address is not claimed by this account.'
		case 'current_email':
			return 'You cannot release the email this account currently uses to sign in.'
		case 'daily_cap':
			return 'You have released the maximum number of addresses for today. Try again tomorrow.'
		default: {
			const unreachable: never = reason
			return unreachable
		}
	}
}

export async function loadVerifyEmailClaimReleasePage(
	request: Request,
	env: Env,
): Promise<AppPageResult> {
	const url = new URL(request.url)
	const result = await verifyEmailClaimReleaseToken({
		db: env.APP_DB,
		token: url.searchParams.get('token'),
	})
	const requestIp = getRequestIp(request) ?? undefined

	if (!result.ok) {
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'email_claim_release_verify',
			result: result.reason === 'daily_cap' ? 'rate_limited' : 'failure',
			ip: requestIp,
			path: url.pathname,
			reason: result.reason,
		})
		return {
			title: 'Release email',
			status: result.reason === 'daily_cap' ? 429 : 400,
			loaderData: {
				emailVerification: {
					ok: false,
					error: getVerifyEmailClaimReleaseError(result.reason),
				},
			},
		}
	}

	void logAuditEvent({
		db: auditDatabaseFromEnv(env),
		category: 'account',
		action: 'email_claim_release_verify',
		result: 'success',
		ip: requestIp,
		path: url.pathname,
		reason: 'released',
	})
	return {
		title: 'Email released',
		loaderData: {
			emailVerification: {
				ok: true,
				kind: 'email_claim_release',
				message:
					'That former address is no longer tied to this account. It can be used to create a new Kody account.',
				ctaHref: '/account',
				ctaLabel: 'Go to account',
			},
		},
	}
}

export function createVerifyEmailClaimReleaseHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const result = await loadVerifyEmailClaimReleasePage(request, env)
			return renderAppPage({ request, env, ...result })
		},
	} satisfies Action<typeof routes.verifyEmailClaimRelease>
}

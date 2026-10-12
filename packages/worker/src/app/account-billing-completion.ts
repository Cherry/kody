import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import { userHasMcpOAuthGrants } from '#app/onboarding-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { isBillingConfigured } from '#worker/billing/billing-config.ts'
import {
	BillingLinkError,
	linkStripeCustomerFromCheckoutSessionAttribution,
} from '#worker/billing/subscription-sync.ts'

function billingErrorRedirect(request: Request, errorCode: string) {
	const url = new URL('/account/billing', request.url)
	url.searchParams.set('error', errorCode)
	return Response.redirect(url.toString(), 302)
}

/** Completes checkout only for the authenticated owner verified by Stripe attribution. */
export async function completeAccountBillingCheckout(
	request: Request,
	env: Env,
) {
	const user = await requireAuthenticatedPageUser(request, env)
	if (user instanceof Response) {
		return user
	}

	if (!isBillingConfigured(env)) {
		return billingErrorRedirect(request, 'billing_not_configured')
	}

	const sessionId =
		new URL(request.url).searchParams.get('session_id')?.trim() ?? ''
	if (!sessionId) {
		return billingErrorRedirect(request, 'missing_session')
	}

	const requestIp = getRequestIp(request) ?? undefined
	try {
		await linkStripeCustomerFromCheckoutSessionAttribution({
			env,
			sessionId,
			user: {
				id: user.userId,
				email: user.email,
				stableUserId: user.mcpUser.userId,
			},
		})
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'billing_checkout_linked',
			result: 'success',
			email: user.email,
			ip: requestIp,
			path: new URL(request.url).pathname,
		})
		const hasMcpClient = await userHasMcpOAuthGrants(env, user.mcpUser.userId)
		const needsOnboarding = !user.emailVerified || !hasMcpClient
		return { ok: true as const, needsOnboarding }
	} catch (error) {
		const code = error instanceof BillingLinkError ? error.code : 'link_failed'
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'billing_checkout_linked',
			result: 'failure',
			email: user.email,
			ip: requestIp,
			path: new URL(request.url).pathname,
			reason: code,
		})
		return billingErrorRedirect(request, code)
	}
}

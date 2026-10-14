import { type AppPageResult } from '#app/page-result.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import {
	optOutTipsEmails,
	tipsUnsubscribeOneClickBody,
	verifyTipsUnsubscribeToken,
} from '#worker/usage/tips-unsubscribe.ts'

function getUnsubscribeError(reason: 'missing_token' | 'invalid_token') {
	switch (reason) {
		case 'missing_token':
			return 'Unsubscribe token is required.'
		case 'invalid_token':
			return 'Unsubscribe link is invalid.'
		default: {
			const unreachable: never = reason
			return unreachable
		}
	}
}

export async function loadUnsubscribeTipsPage(
	request: Request,
	env: Env,
): Promise<AppPageResult | Response> {
	const url = new URL(request.url)
	return executeUnsubscribeTips({
		request,
		env,
		token: url.searchParams.get('token'),
		oneClick: request.method === 'POST',
	})
}

export async function executeUnsubscribeTips({
	request,
	env,
	token,
	oneClick,
}: {
	request: Request
	env: Env
	token: string | null
	oneClick: boolean
}): Promise<AppPageResult | Response> {
	const claims = await verifyTipsUnsubscribeToken({
		env,
		token,
	})
	const requestIp = getRequestIp(request) ?? undefined

	if (!claims) {
		const reason = token?.trim() ? 'invalid_token' : 'missing_token'
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'auth',
			action: 'tips_unsubscribe',
			result: 'failure',
			ip: requestIp,
			path: '/unsubscribe/tips',
			reason,
		})
		if (oneClick) {
			return new Response(getUnsubscribeError(reason), {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			})
		}
		return {
			title: 'Unsubscribe from tips',
			status: 400,
			loaderData: {
				tipsUnsubscribe: {
					ok: false,
					error: getUnsubscribeError(reason),
				},
			},
		}
	}

	if (oneClick) {
		const body = (await request.text()).trim()
		if (body && body !== tipsUnsubscribeOneClickBody) {
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'auth',
				action: 'tips_unsubscribe',
				result: 'failure',
				ip: requestIp,
				path: '/unsubscribe/tips',
				reason: 'invalid_one_click_body',
			})
			return new Response('Invalid one-click unsubscribe body.', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			})
		}
	}

	const result = await optOutTipsEmails({
		db: env.APP_DB,
		userId: claims.userId,
	})
	void logAuditEvent({
		db: auditDatabaseFromEnv(env),
		category: 'auth',
		action: 'tips_unsubscribe',
		result: result.optedOut ? 'success' : 'failure',
		ip: requestIp,
		path: '/unsubscribe/tips',
		reason: result.alreadyOptedOut
			? 'already_opted_out'
			: result.optedOut
				? 'opted_out'
				: 'user_not_found',
	})

	if (!result.optedOut) {
		if (oneClick) {
			return new Response('Unsubscribe link is invalid.', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			})
		}
		return {
			title: 'Unsubscribe from tips',
			status: 400,
			loaderData: {
				tipsUnsubscribe: {
					ok: false,
					error: 'Unsubscribe link is invalid.',
				},
			},
		}
	}

	const message = result.alreadyOptedOut
		? 'You were already unsubscribed from Kody tips.'
		: 'You are unsubscribed from Kody tips. Transactional mail such as verification, billing, and error-rate alerts is unchanged.'
	if (oneClick) {
		return new Response(message, {
			status: 200,
			headers: { 'content-type': 'text/plain; charset=utf-8' },
		})
	}
	return {
		title: 'Unsubscribed from tips',
		loaderData: {
			tipsUnsubscribe: {
				ok: true,
				alreadyOptedOut: result.alreadyOptedOut,
				message,
			},
		},
	}
}

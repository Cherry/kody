import { loadAccountUsageData } from './account-usage-data.ts'
import { type readAuthenticatedAppUser } from './authenticated-user.ts'
import { accountCreditsPath } from '#universal/compute-overage.ts'
import {
	applyCreditTopUpFromCheckoutSession,
	CreditTopUpError,
} from '#worker/billing/credit-top-ups.ts'
const creditsNoticeMessages: Record<string, string> = {
	added:
		'Credits added. Usage past your monthly include runs on them within a minute.',
}

const creditsErrorMessages: Record<string, string> = {
	topup_failed: 'We could not confirm that top-up. Refresh in a moment.',
	not_paid: 'That top-up has not been paid yet.',
	client_reference_mismatch: 'That top-up does not belong to your account.',
}

function readMessage(
	messages: Record<string, string>,
	code: string | null,
): string | undefined {
	return code && Object.hasOwn(messages, code) ? messages[code] : undefined
}

function creditsRedirect(request: Request, params: Record<string, string>) {
	const url = new URL(accountCreditsPath, request.url)
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value)
	}
	return Response.redirect(url.toString(), 302)
}

export async function loadAccountUsagePageResult(
	env: Env,
	request: Request,
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>,
) {
	const searchParams = new URL(request.url).searchParams
	const sessionId = searchParams.get('session_id')?.trim()
	if (searchParams.get('topup') === 'success' && sessionId) {
		try {
			await applyCreditTopUpFromCheckoutSession({
				env,
				sessionId,
				expectedStableUserId: user.mcpUser.userId,
				now: new Date(),
			})
			return creditsRedirect(request, { credits: 'added' })
		} catch (error) {
			const code =
				error instanceof CreditTopUpError ? error.code : 'topup_failed'
			console.error('credit_top_up_confirm_failed', { code })
			return creditsRedirect(request, {
				error: readMessage(creditsErrorMessages, code) ? code : 'topup_failed',
			})
		}
	}

	const accountUsage = await loadAccountUsageData({
		env,
		userId: user.userId,
		notice: readMessage(creditsNoticeMessages, searchParams.get('credits')),
		error: readMessage(creditsErrorMessages, searchParams.get('error')),
	})
	if (!accountUsage) {
		return new Response('Not found', { status: 404 })
	}
	return accountUsage
}

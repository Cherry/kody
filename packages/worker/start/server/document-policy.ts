import { env } from 'cloudflare:workers'
import { getEnv } from '#app/env.ts'
import { applyReferralCookie } from '#app/referral-cookie-middleware.ts'
import { orgRequestIsDenied } from '#app/org-binding-guard-middleware.ts'
import { withProtocolAccountWriteLease } from '#app/account-write-lease-middleware.ts'

/** Document/protocol policies. Native server functions authorize their own writes. */
export async function applyDocumentPolicies<T extends { response: Response }>(
	request: Request,
	next: (options: {
		context: { documentFailure?: { status: 404 } }
	}) => Promise<T>,
): Promise<T | Response> {
	const bindings = getEnv(env)
	const denied = await orgRequestIsDenied(request, bindings)
	if (
		denied &&
		(request.method !== 'GET' ||
			new URL(request.url).pathname.endsWith('.json'))
	) {
		return applyReferralCookie(
			request,
			Response.json(
				{ ok: false, error: 'Organization not found.' },
				{ status: 404 },
			),
		)
	}
	const result = await withProtocolAccountWriteLease(request, bindings, () =>
		next({ context: denied ? { documentFailure: { status: 404 } } : {} }),
	)
	if (result instanceof Response) return applyReferralCookie(request, result)
	return { ...result, response: applyReferralCookie(request, result.response) }
}

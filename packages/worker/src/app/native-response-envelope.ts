import { withAgentDiscoveryLinkHeaders } from './agent-discovery.ts'
import { getAppBaseUrl } from '../app-base-url.ts'
import {
	resolveAppPageCacheControl,
	type AnonymousDocumentCachePolicy,
} from './anonymous-html-cache.ts'
import { firstPartySecurityHeaders } from './security-headers.ts'
export function secureNativeResponse(
	request: Request,
	response: Response,
	env: Env,
	nonce: string,
	documentFailure?: { status: 403 | 404 | 500 },
	policy?: AnonymousDocumentCachePolicy,
) {
	const url = new URL(request.url)
	const headers = new Headers(response.headers)
	for (const [name, value] of Object.entries(firstPartySecurityHeaders))
		headers.set(name, value)
	headers.set(
		'Content-Security-Policy',
		`${firstPartySecurityHeaders['Content-Security-Policy']}`.replace(
			"script-src 'self'",
			`script-src 'self' 'nonce-${nonce}'`,
		),
	)
	const cache = resolveAppPageCacheControl({
		policy,
		request,
		session: request.headers.has('Authorization') ? {} : null,
		responseSetsCookie: headers.has('Set-Cookie'),
		status: documentFailure?.status ?? response.status,
		localDev: env.WRANGLER_IS_LOCAL_DEV === 'true',
	})
	if (
		(headers.get('Content-Type')?.includes('text/html') &&
			response.status === 200) ||
		!headers.has('Cache-Control')
	)
		headers.set('Cache-Control', cache.cacheControl)
	if (cache.vary) headers.append('Vary', cache.vary)
	const documentResponse = new Response(
		request.method === 'HEAD' ? null : response.body,
		{
			status: documentFailure?.status ?? response.status,
			statusText: response.statusText,
			headers,
		},
	)
	return url.pathname === '/' &&
		headers.get('Content-Type')?.includes('text/html')
		? withAgentDiscoveryLinkHeaders(
				documentResponse,
				getAppBaseUrl({ env, requestUrl: request.url }),
			)
		: documentResponse
}

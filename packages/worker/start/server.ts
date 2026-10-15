import { getGlobalStartContext } from '@tanstack/react-start'
import { withAgentDiscoveryLinkHeaders } from '../src/app/agent-discovery.ts'
import { getAppBaseUrl } from '../src/app-base-url.ts'
import { resolveAppPageCacheControl } from '../src/app/anonymous-html-cache.ts'
import type {} from './request-context.ts'
import {
	createStartHandler,
	defaultStreamHandler,
	getResponseStatus,
} from '@tanstack/react-start/server'
import { firstPartySecurityHeaders } from '../src/app/security-headers.ts'

const startHandler = createStartHandler(async (context) => {
	const nonce = getGlobalStartContext()?.nonce
	if (!nonce || context.router.options.ssr?.nonce !== nonce) {
		throw new Error('Document rendering requires its matching request nonce')
	}
	const status = getResponseStatus()
	const result = await defaultStreamHandler(context)
	const response = result instanceof Response ? result : result.response
	if (status === 200 || response.status !== 200) return result
	const withStatus = new Response(response.body, {
		status,
		headers: response.headers,
	})
	return result instanceof Response
		? withStatus
		: { ...result, response: withStatus }
})

export async function renderNativeDocument(
	request: Request,
	env: Env,
	documentFailure?: { status: 403 | 404 | 500 },
) {
	const url = new URL(request.url)
	const nonce = crypto.randomUUID().replaceAll('-', '')
	const response = await renderStart()
	function renderStart() {
		return startHandler(request, {
			context: {
				nonce,
				env,
				documentFailure,
			},
		})
	}
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
		pathname: url.pathname,
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

export default { fetch: startHandler }

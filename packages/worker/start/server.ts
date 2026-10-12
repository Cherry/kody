import { getGlobalStartContext } from '@tanstack/react-start'
import { withAgentDiscoveryLinkHeaders } from '../src/app/agent-discovery.ts'
import { getAppBaseUrl } from '../src/app-base-url.ts'
import { isNegotiatedDocumentPath } from './document-negotiation.ts'
import { dispatchDocumentMethod } from './action-page-method.ts'
import { resolveAppPageCacheControl } from '../src/app/anonymous-html-cache.ts'
import type {} from './request-context.ts'
import { type OAuthPageOptions } from '#universal/oauth-page.ts'
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
	oauthPage?: OAuthPageOptions,
	documentFailure?: { status: 403 | 404 | 500 },
) {
	return dispatchDocumentMethod({
		request,
		readDestinationHead: async () => {
			const { loadVerifyEmailDestinationPage } =
				await import('../src/app/handlers/verify-email-destination.ts')
			const result = await loadVerifyEmailDestinationPage(request, env)
			if (result instanceof Response) return result
			throw new Error('Expected a read-only verification response')
		},
		render: async () => {
			const url = new URL(request.url)
			const nonce = crypto.randomUUID().replaceAll('-', '')
			let response: Response
			if (url.pathname.startsWith('/admin')) {
				const { requirePageUserWithRole } =
					await import('../src/app/page-auth.ts')
				const user = await requirePageUserWithRole(request, env, 'admin')
				if (user instanceof Response) response = user
				else response = await renderStart()
			} else response = await renderStart()
			function renderStart() {
				return startHandler(request, {
					context: {
						nonce,
						documentFailure,
						oauthPage: oauthPage
							? { ...oauthPage, href: request.url }
							: undefined,
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
				responseSetsCookie:
					headers.has('Set-Cookie') || Boolean(oauthPage?.setCookie),
				status: documentFailure?.status ?? oauthPage?.status ?? response.status,
				localDev: env.WRANGLER_IS_LOCAL_DEV === 'true',
			})
			if (response.status === 200 || !headers.has('Cache-Control'))
				headers.set('Cache-Control', cache.cacheControl)
			if (cache.vary) headers.append('Vary', cache.vary)
			if (
				headers.get('Content-Type')?.includes('text/html') &&
				isNegotiatedDocumentPath(url.pathname)
			) {
				const vary =
					headers
						.get('Vary')
						?.split(',')
						.map((value) => value.trim().toLowerCase()) ?? []
				if (!vary.includes('accept') && !vary.includes('*'))
					headers.append('Vary', 'Accept')
			}
			if (oauthPage?.setCookie)
				headers.append('Set-Cookie', oauthPage.setCookie)
			const documentResponse = new Response(
				request.method === 'HEAD' ? null : response.body,
				{
					status:
						documentFailure?.status ?? oauthPage?.status ?? response.status,
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
		},
	})
}

export default { fetch: startHandler }

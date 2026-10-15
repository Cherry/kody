import { anonymousDocumentCachePolicy } from '../document-cache-policy.ts'
import { getResponseHeaders } from '@tanstack/react-start/server'
import { getGlobalStartContext, getRouterInstance } from '@tanstack/react-start'
import { getStartRequestEnv } from './request-env.ts'
import { secureNativeResponse } from '../../src/app/native-response-envelope.ts'
import { serveAnonymousHtmlFromCache } from '../../src/app/anonymous-html-edge-cache.ts'
import { deferWork } from '../../src/deferred-work.ts'

export async function serveNativeDocument(
	request: Request,
	next: () => Promise<Response>,
) {
	const context = getGlobalStartContext()
	if (!context?.nonce)
		throw new Error('Document cache requires its request nonce')
	const env = getStartRequestEnv()
	const router = await getRouterInstance()
	const policy = anonymousDocumentCachePolicy(
		router,
		new URL(request.url).pathname,
	)
	return serveAnonymousHtmlFromCache(
		request,
		env,
		{
			waitUntil: (promise) => {
				void deferWork('anonymous-document-cache-write-failed', () => promise)
			},
		},
		async () => {
			const response = secureNativeResponse(
				request,
				await next(),
				env,
				context.nonce,
				context.documentFailure,
				policy,
			)
			// Event cookies are merged after route middleware. They disqualify every
			// content type, including text indexes with an existing public policy.
			if (getResponseHeaders().has('Set-Cookie'))
				response.headers.set('Cache-Control', 'no-store')
			return response
		},
		{
			policy:
				context.documentFailure || getResponseHeaders().has('Set-Cookie')
					? undefined
					: policy,
			nonce: context.nonce,
		},
	)
}

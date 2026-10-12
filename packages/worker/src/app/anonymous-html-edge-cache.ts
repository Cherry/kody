import { prepareNonceHtmlForDelivery } from './anonymous-html-nonce.ts'
import { getCanonicalAppBaseUrl } from '#worker/app-base-url.ts'
import {
	anonymousHtmlCacheControl,
	anonymousVisibilityGatedCacheControl,
	isCacheableAnonymousPath,
	requestHasSessionCookie,
} from '#app/anonymous-html-cache.ts'
import { requestBypassesAnonymousDocumentCache } from '#universal/frame-constants.ts'
import { requestHasSiteBannerDismissCookie } from '#universal/site-banner-cookie.ts'
import { prefersMarkdown } from '#app/markdown-negotiation.ts'

export const anonymousHtmlEdgeCacheHeader = 'X-Kody-Cache'
export const anonymousHtmlCacheAcceptParam = '__accept'
export const anonymousHtmlCacheAcceptHtml = 'html'
export const anonymousHtmlCacheVersionParam = '__worker_version'

const browserVaryStorageHeader = 'X-Kody-Browser-Vary'

type AnonymousHtmlCacheEnv = {
	CF_VERSION_METADATA?: { id: string }
	APP_BASE_URL?: string | null
	PACKAGE_APP_BASE_URL?: string | null
	PACKAGE_APP_LEGACY_HOSTS?: string | null
	PACKAGE_APP_LEGACY_REDIRECT?: string | null
	WRANGLER_IS_LOCAL_DEV?: string | undefined
}

function requestBypassesAnonymousHtmlCache(request: Request) {
	const cacheControl = request.headers.get('Cache-Control') ?? ''
	return /\bno-cache\b/i.test(cacheControl)
}

export function isAnonymousHtmlCacheRequest(
	request: Request,
	env: AnonymousHtmlCacheEnv,
) {
	// Local dev persists caches.default under .wrangler/state and workerd
	// honors stale-while-revalidate, so a stored document outlives the edit
	// that changed it by minutes: the browser reload Vite triggers after an
	// HMR update carries no `no-cache` and would replay the pre-edit page.
	if (env.WRANGLER_IS_LOCAL_DEV === 'true') return false
	// A previous release may reference assets removed by the current deploy.
	// Without a deployment identity, rendering is safer than sharing HTML.
	if (!env.CF_VERSION_METADATA?.id.trim()) return false
	if (request.method !== 'GET' && request.method !== 'HEAD') return false
	if (request.headers.has('Authorization')) return false
	if (requestHasSessionCookie(request)) return false
	if (requestHasSiteBannerDismissCookie(request)) return false
	if (requestBypassesAnonymousDocumentCache(request)) return false
	if (requestBypassesAnonymousHtmlCache(request)) return false
	if (prefersMarkdown(request)) return false
	let url: URL
	try {
		url = new URL(request.url)
	} catch {
		return false
	}
	// Legacy app hosts and package-app hosts have their own handlers (308
	// redirects, package apps) that must run on every request; only the
	// canonical first-party origin is safe to answer from the shared cache.
	if (url.origin !== getCanonicalAppBaseUrl({ env, requestUrl: url })) {
		return false
	}
	return isCacheableAnonymousPath(url.pathname)
}

export function buildAnonymousHtmlCacheKey(
	request: Request,
	env: AnonymousHtmlCacheEnv,
) {
	const versionId = env.CF_VERSION_METADATA?.id.trim()
	if (!versionId) throw new Error('HTML cache requires Worker version metadata')
	const url = new URL(request.url)
	url.searchParams.set(anonymousHtmlCacheVersionParam, versionId)
	const origin = getCanonicalAppBaseUrl({ env, requestUrl: url })
	url.searchParams.set(
		anonymousHtmlCacheAcceptParam,
		anonymousHtmlCacheAcceptHtml,
	)
	return new Request(`${origin}${url.pathname}${url.search}`, {
		method: 'GET',
	})
}

export function isAnonymousHtmlCacheStoreable(response: Response) {
	if (response.status !== 200) return false
	if (response.headers.has('Set-Cookie')) return false
	const contentType = response.headers.get('Content-Type') ?? ''
	if (!contentType.toLowerCase().includes('text/html')) return false
	const cacheControl = response.headers.get('Cache-Control')
	return (
		cacheControl === anonymousHtmlCacheControl ||
		cacheControl === anonymousVisibilityGatedCacheControl
	)
}

function stripCookieVary(headers: Headers) {
	const vary = headers.get('Vary')
	if (!vary) return
	const parts = vary
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && part.toLowerCase() !== 'cookie')
	if (parts.length === 0) headers.delete('Vary')
	else headers.set('Vary', parts.join(', '))
}

/**
 * A streamed SSR document that fails part-way (render error, HMR mid-flight,
 * client abort) can still end cleanly at whatever bytes were written. Only a
 * body that reached the closing `</html>` is a document worth sharing; a
 * shorter one served as a HIT is a blank page for every anonymous visitor
 * until the entry expires.
 */
export function isCompleteHtmlDocument(html: string) {
	return /<\/html\s*>/i.test(html)
}

export function buildAnonymousHtmlCacheEntry(response: Response, html: string) {
	const headers = new Headers(response.headers)
	headers.delete(anonymousHtmlEdgeCacheHeader)
	const originalVary = headers.get('Vary')
	if (originalVary) {
		headers.set(browserVaryStorageHeader, originalVary)
	}
	stripCookieVary(headers)
	return new Response(html, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

async function storeCompleteAnonymousHtml(
	cache: Cache,
	cacheKey: Request,
	response: Response,
) {
	// Buffer first: an errored or truncated body must never reach `put`.
	const html = await response.text()
	if (!isCompleteHtmlDocument(html)) {
		console.warn('anonymous-html-cache-skip-incomplete', {
			url: cacheKey.url,
			bytes: html.length,
		})
		return
	}
	await cache.put(cacheKey, buildAnonymousHtmlCacheEntry(response, html))
}

function withAnonymousHtmlCacheLookup(
	response: Response,
	lookup: 'HIT' | 'MISS',
	method: string,
) {
	const headers = new Headers(response.headers)
	if (lookup === 'HIT') {
		const storedVary = headers.get(browserVaryStorageHeader)
		headers.delete(browserVaryStorageHeader)
		if (storedVary) {
			headers.set('Vary', storedVary)
		} else {
			headers.set('Vary', 'Cookie')
		}
	}
	headers.set(anonymousHtmlEdgeCacheHeader, lookup)
	if (method === 'HEAD') {
		return new Response(null, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	})
}

function workerDefaultCache(): Cache | null {
	if (typeof caches === 'undefined') return null
	const store = caches as CacheStorage & { default?: Cache }
	return store.default ?? null
}

export async function serveAnonymousHtmlFromCache(
	request: Request,
	env: AnonymousHtmlCacheEnv,
	ctx: ExecutionContext,
	next: () => Promise<Response>,
): Promise<Response> {
	const eligible = isAnonymousHtmlCacheRequest(request, env)
	if (!eligible)
		return prepareNonceHtmlForDelivery(await next(), { cached: false })

	const cacheKey = buildAnonymousHtmlCacheKey(request, env)
	const cache = workerDefaultCache()
	if (cache) {
		const cached = await cache.match(cacheKey).catch(() => undefined)
		if (cached) {
			return prepareNonceHtmlForDelivery(
				withAnonymousHtmlCacheLookup(cached, 'HIT', request.method),
				{ cached: true },
			)
		}
	}

	const response = await next()
	if (
		request.method === 'GET' &&
		cache &&
		isAnonymousHtmlCacheStoreable(response)
	) {
		ctx.waitUntil(
			storeCompleteAnonymousHtml(cache, cacheKey, response.clone()).catch(
				(error: unknown) => {
					console.debug('anonymous-html-cache-put-failed', error)
				},
			),
		)
	}
	return prepareNonceHtmlForDelivery(
		withAnonymousHtmlCacheLookup(response, 'MISS', request.method),
		{ cached: false },
	)
}

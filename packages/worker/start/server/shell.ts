import { buildSsrSentryClientConfig } from '#universal/sentry-config.ts'
import { createServerFn } from '@tanstack/react-start'

/** Fresh foreground verification, without presentation or feature-flag reads. */
export const verifySession = createServerFn({ method: 'GET' }).handler(
	async () => {
		const [
			{ env },
			{ getRequest },
			{ loadResolvedRequestAuth },
			{ setAuthSessionSecret },
			{ getEnv },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/request-auth-cache.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/env.ts'),
		])
		setAuthSessionSecret(getEnv(env).COOKIE_SECRET)
		const { user } = await loadResolvedRequestAuth(getRequest(), env)
		return {
			actorKey:
				user && !user.accountSuspended && !user.accountDeleting
					? user.mcpUser.userId
					: null,
		}
	},
)

export const loadShell = createServerFn({ method: 'GET' })
	.validator((data: { pathname: string; search: string }) => {
		if (
			!data ||
			typeof data.pathname !== 'string' ||
			!data.pathname.startsWith('/') ||
			data.pathname.startsWith('//') ||
			data.pathname.includes('\\') ||
			typeof data.search !== 'string' ||
			(data.search !== '' && !data.search.startsWith('?'))
		)
			throw new Error('Invalid page location')
		return data
	})
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ loadSessionInfo },
			{ loadResolvedRequestAuth },
			{ setAuthSessionSecret },
			{ getEnv },
			{ getCanonicalAppBaseUrl },
			{ loadEnabledSiteBannersForSsr, loadSiteBannerLoaderData },
			{ loadYoutubeWatchLoaderData },
			{ parseYoutubeWatchSearch },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/session-info.ts'),
			import('../../src/app/request-auth-cache.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/env.ts'),
			import('../../src/app-base-url.ts'),
			import('../../src/app/site-banner-ssr.ts'),
			import('../../src/app/youtube-watch-ssr.ts'),
			import('../../universal/youtube-watch.ts'),
		])
		const appEnv = getEnv(env)
		setAuthSessionSecret(appEnv.COOKIE_SECRET)
		const request = getRequest()
		const pageUrl = new URL(request.url)
		pageUrl.pathname = data.pathname
		pageUrl.search = data.search
		const pageRequest = new Request(pageUrl, { headers: request.headers })
		// Banner lookup is independent of the session, so let both reads overlap.
		const listedBanners = loadEnabledSiteBannersForSsr(env)
		const [{ session, setCookie }, resolvedAuth] = await Promise.all([
			loadSessionInfo(request, env),
			loadResolvedRequestAuth(request, env),
		])
		if (setCookie) setResponseHeader('Set-Cookie', setCookie)
		const [siteBanner, youtubeWatch] = await Promise.all([
			loadSiteBannerLoaderData({
				request: pageRequest,
				env,
				session,
				pathname: data.pathname,
				listedBanners,
			}),
			loadYoutubeWatchLoaderData({
				env,
				listedBanners,
				loadPlaylists: parseYoutubeWatchSearch(data.search) !== null,
			}),
		])
		return {
			actorKey:
				session && resolvedAuth.user ? resolvedAuth.user.mcpUser.userId : null,
			session,
			sentryConfig: buildSsrSentryClientConfig({
				dsn: appEnv.SENTRY_DSN,
				environment: appEnv.SENTRY_ENVIRONMENT,
				release: appEnv.APP_COMMIT_SHA,
				localDev: appEnv.WRANGLER_IS_LOCAL_DEV === 'true',
			}),
			fathomSiteId: appEnv.FATHOM_SITE_ID?.trim() || null,
			siteBanner,
			youtubeWatch,
			canonicalOrigin: getCanonicalAppBaseUrl({
				env: appEnv,
				requestUrl: request.url,
			}),
		}
	})

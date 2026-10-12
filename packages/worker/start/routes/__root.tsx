/** @jsxImportSource @emotion/react */
import {
	createRootRouteWithContext,
	isRedirect,
	Outlet,
	Scripts,
	useLocation,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useSuspenseQuery, type QueryClient } from '@tanstack/react-query'
import { readDocumentActor } from '../document-actor.ts'
import {
	parseDocumentActor,
	documentActorMetaName,
} from '../session-identity.ts'
import { refreshOnActivation } from '../refresh-on-activation.ts'
import { refreshActiveQueries } from '../refresh-active-queries.ts'
import { captureClientException } from '#client/sentry-client.ts'
import { CANONICAL_ORIGIN_META_NAME } from '#universal/document-head-markers.ts'
import { SENTRY_CONFIG_META_NAME } from '#universal/sentry-config.ts'
import { NotFoundPage } from '../components/not-found-page.tsx'
import { InternalErrorPage } from '../components/internal-error-page.tsx'
import { Toaster } from '../components/toaster.tsx'
import { SiteBanner } from '../components/site-banner.tsx'
import { YouTubeWatchOverlay } from '../components/youtube-watch-overlay.tsx'

import { verifySession } from '#start/server/shell'
import {
	shellQuery,
	ensureShellQuery,
	requiresSessionVerification,
} from '../shell-query.ts'
import {
	absolutizeDocumentHead,
	resolveDocumentHead,
} from '#universal/document-head.ts'
import { SiteHeader } from '../components/site-header.tsx'
import { SiteFooter } from '../components/site-footer.tsx'
import { visuallyHiddenUntilFocusedCss } from '#universal/styles/style-primitives.ts'
import { documentHead } from '../components/document-head.ts'
import { PageHead } from '../components/page-head.tsx'
import { buildAuthLink } from '#client/auth-links.ts'
import { appFrameCss, appMainCss } from '../components/app-layout.ts'
import { AppBrowserEffects } from '../components/app-browser-effects.tsx'
import stylesheet from '../../public/styles.css?raw'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
	{
		// Query owns shell presentation freshness. Private foreground navigation
		// independently verifies the immutable document actor before committing.
		preload: false,
		shouldReload: true,
		notFoundComponent: NotFoundPage,
		// Only these search values affect shell content or root head metadata.
		// Session verification is independent of presentation cache freshness.
		loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
			youtubeId: search.youtubeId,
			og: search.og,
			siteBannerLook: search.siteBannerLook,
			siteBannerPreview: search.siteBannerPreview,
		}),
		beforeLoad: async ({ location, abortController, preload }) => {
			if (typeof document === 'undefined') {
				return verifySession({ signal: abortController.signal })
			}
			const actorKey = parseDocumentActor(readDocumentActor())
			if (!preload && requiresSessionVerification(location.pathname)) {
				await verifySession({ signal: abortController.signal })
				abortController.signal.throwIfAborted()
			}
			return { actorKey }
		},
		loader: {
			staleReloadMode: 'blocking',
			handler: async ({ context, location }) => {
				const shell = await ensureShellQuery(
					context.queryClient,
					context.actorKey,
					location.searchStr,
				)
				return {
					actorKey: shell.actorKey,
					shellLocation: {
						pathname: location.pathname,
						searchStr: location.searchStr,
					},
					sentryConfig: shell.sentryConfig,
					head: absolutizeDocumentHead(
						resolveDocumentHead(
							location.pathname,
							undefined,
							location.searchStr,
						),
						shell.canonicalOrigin,
					),
				}
			},
		},
		head: ({ loaderData }) => ({
			meta: [
				{
					name: documentActorMetaName,
					content: JSON.stringify(loaderData?.actorKey ?? null),
				},
				...documentHead(loaderData?.head).meta,
				...(loaderData?.sentryConfig
					? [
							{
								name: SENTRY_CONFIG_META_NAME,
								content: JSON.stringify(loaderData.sentryConfig),
							},
						]
					: []),
			],
			links: documentHead(loaderData?.head).links ?? [],
		}),
		component: Root,
		errorComponent: () => (
			<html lang="en" suppressHydrationWarning>
				<head>
					<title>Something went wrong | Kody</title>
					<meta name={documentActorMetaName} content="null" />
					<style dangerouslySetInnerHTML={{ __html: stylesheet }} />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
				</head>
				<body>
					<main>
						<InternalErrorPage />
					</main>
					<Toaster />
					<Scripts />
				</body>
			</html>
		),
	},
)

export function useShellData() {
	const { actorKey } = Route.useRouteContext()
	const { shellLocation } = Route.useLoaderData()
	return useSuspenseQuery(shellQuery(actorKey, shellLocation.searchStr)).data
}

function Root() {
	const { shellLocation } = Route.useLoaderData()
	const { session, siteBanner, youtubeWatch, fathomSiteId, canonicalOrigin } =
		useShellData()
	const router = useRouter()
	const { queryClient, actorKey } = Route.useRouteContext()
	useEffect(() => {
		document.documentElement.dataset.hydrated = 'true'
	}, [])
	useEffect(
		() =>
			refreshOnActivation({
				window,
				document,
				refresh: async () => {
					try {
						await refreshActiveQueries(queryClient, actorKey, verifySession)
					} catch (error) {
						if (!isRedirect(error)) throw error
						await router.navigate(error.options)
						return
					}
				},
				onError: captureClientException,
			}),
		[actorKey, queryClient, router],
	)
	const pathname = useLocation({ select: (location) => location.pathname })
	const previousPathname = useRef(pathname)
	useEffect(() => {
		if (previousPathname.current === pathname) return
		previousPathname.current = pathname
		const frame = requestAnimationFrame(() =>
			(
				document.querySelector<HTMLElement>('[data-docs-heading]') ??
				document.getElementById('main')
			)?.focus({ preventScroll: true }),
		)
		return () => cancelAnimationFrame(frame)
	}, [pathname])
	const illustratedError = useRouterState({
		select: (state) =>
			state.matches.some(
				(match) => match.status === 'notFound' || match.status === 'error',
			),
	})
	const authReturnHref = useLocation({
		select: (location) => `${location.pathname}${location.searchStr}`,
	})
	const loginHref = buildAuthLink(
		'/login',
		pathname === '/oauth/authorize' ? authReturnHref : null,
	)
	const authShell = pathname === '/login' || pathname === '/signup'
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<link rel="manifest" href="/site.webmanifest" />
				<meta
					name="theme-color"
					content="#e6e8ea"
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content="#111417"
					media="(prefers-color-scheme: dark)"
				/>
				<script src="/page-init.js" />
				<link
					rel="preload"
					as="font"
					type="font/woff2"
					href="/fonts/bricolage-grotesque-latin.woff2"
					crossOrigin="anonymous"
				/>
				<link
					rel="preload"
					as="font"
					type="font/woff2"
					href="/fonts/wix-madefor-text-latin.woff2"
					crossOrigin="anonymous"
				/>
				{canonicalOrigin ? (
					<meta name={CANONICAL_ORIGIN_META_NAME} content={canonicalOrigin} />
				) : null}
				<PageHead />
				{fathomSiteId ? (
					<>
						<link rel="preconnect" href="https://cdn.usefathom.com" />
						<script
							src="https://cdn.usefathom.com/script.js"
							data-site={fathomSiteId}
							data-spa="auto"
							defer
						/>
					</>
				) : null}
				<style dangerouslySetInnerHTML={{ __html: stylesheet }} />
			</head>
			<body>
				<AppBrowserEffects />
				<div data-app-frame css={appFrameCss}>
					<a href="#main" css={visuallyHiddenUntilFocusedCss}>
						Skip to content
					</a>
					<SiteBanner snapshot={siteBanner} location={shellLocation} />
					{authShell ? null : (
						<SiteHeader
							loggedIn={session !== null}
							displayName={session?.username || session?.email || ''}
							username={session?.username ?? ''}
							avatarUrl={session?.avatarUrl ?? null}
							showAdminLink={session?.roles.includes('admin') ?? false}
							showDemoIndicator={
								session?.featureFlags?.['demo-indicator'] === true
							}
							loginHref={loginHref}
							currentPathname={pathname}
						/>
					)}
					<main
						id="main"
						tabIndex={-1}
						css={appMainCss(pathname, illustratedError)}
					>
						<Outlet />
					</main>
					{authShell ? null : (
						<SiteFooter loggedIn={session !== null} loginHref={loginHref} />
					)}
					<YouTubeWatchOverlay
						snapshot={youtubeWatch}
						location={shellLocation}
					/>
					<Toaster />
				</div>
				<Scripts />
			</body>
		</html>
	)
}

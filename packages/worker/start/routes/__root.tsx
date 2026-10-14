/** @jsxImportSource @emotion/react */
import { ErrorAgentPromptButton } from '../components/error-agent-prompt-button.tsx'
import { buildUnauthorizedErrorAgentPrompt } from '#universal/error-agent-prompt-presets.ts'
import { createScarfPageTracker } from '#client/scarf-analytics.ts'
import { FathomTracker } from '../components/fathom-tracker.tsx'
import {
	isPresentationNavigation,
	type CommittedPage,
} from '../presentation-navigation.ts'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'
import {
	createRootRouteWithContext,
	notFound,
	isNotFound,
	isRedirect,
	Outlet,
	Scripts,
	useLocation,
	useLoaderData,
	useRouteContext,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef, type ReactNode } from 'react'
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
import { YouTubeWatchOverlay } from '../components/youtube-watch-overlay.tsx'

import { readDocumentFailure } from '#start/server/document-failure'
import { documentForbiddenMessage } from '../document-failure.ts'
import { SiteLink } from '../components/site-link.tsx'
import { verifySession } from '#start/server/shell'
import {
	shellQuery,
	ensureShellQuery,
	requiresSessionVerification,
} from '../shell-query.ts'
import {
	NOT_FOUND_DOCUMENT_TITLE,
	absolutizeDocumentHead,
	resolveDocumentHead,
} from '#universal/document-head.ts'
import { SiteHeader } from '../components/site-header.tsx'
import { SiteFooter } from '../components/site-footer.tsx'
import { visuallyHiddenUntilFocusedCss } from '#universal/styles/style-primitives.ts'
import { documentHead } from '../components/document-head.ts'
import { PageHead } from '../components/page-head.tsx'
import { buildAuthLink } from '#client/auth-links.ts'
import {
	appFrameCss,
	appMainCss,
	mainGutterPaddingCss,
} from '../components/app-layout.ts'
import { AppBrowserEffects } from '../components/app-browser-effects.tsx'
import stylesheet from '../../public/styles.css?raw'

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient
	getCommittedPage: () => CommittedPage | null
}>()({
	// Query owns shell presentation freshness. Private foreground navigation
	// independently verifies the immutable document actor before committing.
	preload: false,
	shouldReload: true,
	notFoundComponent: NotFoundPage,
	shellComponent: DocumentShell,
	// Only these search values affect shell content or root head metadata.
	// Session verification is independent of presentation cache freshness.
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		youtubeId: search.youtubeId,
		og: search.og,
	}),
	beforeLoad: async ({
		location,
		abortController,
		preload,
		context,
		matches,
	}) => {
		if (typeof document === 'undefined') {
			const identity = await verifySession({
				data: orgSlugFromOrgOwnedPath(location.pathname)
					? { pathname: location.pathname }
					: undefined,
				signal: abortController.signal,
			})
			const failure = readDocumentFailure()
			if (failure?.status === 404)
				throw notFound({ routeId: '__root__', data: identity })
			if (failure?.status === 403)
				throw new Error(documentForbiddenMessage, { cause: identity })
			if (failure?.status === 500)
				throw new Error('The request could not be completed.', {
					cause: identity,
				})
			return identity
		}
		const actorKey = parseDocumentActor(readDocumentActor())
		if (
			!preload &&
			requiresSessionVerification(location.pathname) &&
			!isPresentationNavigation({
				committed: context.getCommittedPage(),
				location,
				matches,
				actorKey,
			})
		) {
			await verifySession({
				data: orgSlugFromOrgOwnedPath(location.pathname)
					? { pathname: location.pathname }
					: undefined,
				signal: abortController.signal,
			})
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
				canonicalOrigin: shell.canonicalOrigin,
				fathomSiteId: shell.fathomSiteId,
				head: absolutizeDocumentHead(
					resolveDocumentHead(location.pathname, undefined, location.searchStr),
					shell.canonicalOrigin,
				),
			}
		},
	},
	head: ({ loaderData }) => ({
		meta: [
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
	errorComponent: ({ error }) => (
		<main id="main">
			{error instanceof Error && error.message === documentForbiddenMessage ? (
				<section data-testid="unauthorized-page" css={mainGutterPaddingCss}>
					<h1>Unauthorized</h1>
					<p>{documentForbiddenMessage}</p>
					<UnauthorizedAgentPrompt />
					<SiteLink href="/">Go home</SiteLink>
				</section>
			) : (
				<InternalErrorPage />
			)}
		</main>
	),
})

export function useShellData() {
	const { actorKey } = useRouteContext({ from: '__root__' })
	const { shellLocation } = useLoaderData({ from: '__root__' })
	return useSuspenseQuery(shellQuery(actorKey, shellLocation.searchStr)).data
}

function Root() {
	const loaded = Route.useLoaderData()
	return loaded ? (
		<LoadedAppLayout />
	) : (
		<main id="main">
			<Outlet />
		</main>
	)
}

function LoadedAppLayout() {
	const { shellLocation } = Route.useLoaderData()
	const { session, youtubeWatch } = useShellData()
	const router = useRouter()
	const { queryClient, actorKey } = Route.useRouteContext()
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
	// Loader data commits with the displayed matches, unlike the pending URL.
	const pathname = shellLocation.pathname
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
	const authReturnHref = `${shellLocation.pathname}${shellLocation.searchStr}`
	const loginHref = buildAuthLink(
		'/login',
		pathname === '/oauth/authorize' ? authReturnHref : null,
	)
	const authShell = pathname === '/login' || pathname === '/signup'
	return (
		<div data-app-frame css={appFrameCss}>
			<a href="#main" css={visuallyHiddenUntilFocusedCss}>
				Skip to content
			</a>
			{authShell ? null : (
				<SiteHeader
					loggedIn={session !== null}
					organizationSession={session}
					displayName={session?.username || session?.email || ''}
					username={session?.username ?? ''}
					avatarUrl={session?.avatarUrl ?? null}
					showAdminLink={session?.roles.includes('admin') ?? false}
					showDemoIndicator={session?.featureFlags?.['demo-indicator'] === true}
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
			<YouTubeWatchOverlay snapshot={youtubeWatch} location={shellLocation} />
		</div>
	)
}

/** The document must render even when beforeLoad prevents every loader. */
function DocumentShell({ children }: { children: ReactNode }) {
	const scarfTracker = useRef<ReturnType<typeof createScarfPageTracker> | null>(
		null,
	)
	const scarfLocation = useRouterState({
		select: (state) =>
			state.status === 'idle' ? state.resolvedLocation?.href : undefined,
	})

	const loaded = Route.useLoaderData()
	const failure = useRouterState({
		select: (state) => state.matches.find((match) => match.error)?.error,
	})
	useEffect(() => {
		if (failure || scarfLocation === undefined) return
		scarfTracker.current ??= createScarfPageTracker()
		scarfTracker.current()
	}, [scarfLocation, failure])
	const identity = isNotFound(failure)
		? failure.data
		: failure instanceof Error
			? failure.cause
			: undefined
	const actorKey = loaded
		? loaded.actorKey
		: identity &&
			  typeof identity === 'object' &&
			  'actorKey' in identity &&
			  typeof identity.actorKey === 'string'
			? identity.actorKey
			: null
	const failureHead = isNotFound(failure)
		? { title: NOT_FOUND_DOCUMENT_TITLE }
		: failure
			? {
					title:
						failure instanceof Error &&
						failure.message === documentForbiddenMessage
							? 'Unauthorized | Kody'
							: 'Something went wrong | Kody',
				}
			: undefined
	useEffect(() => {
		document.documentElement.dataset.hydrated = 'true'
	}, [])
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
				{loaded?.canonicalOrigin ? (
					<meta
						name={CANONICAL_ORIGIN_META_NAME}
						content={loaded.canonicalOrigin}
					/>
				) : null}
				<meta name={documentActorMetaName} content={JSON.stringify(actorKey)} />
				<PageHead overrideHead={failureHead} />
				<FathomTracker siteId={loaded?.fathomSiteId} />
				<style dangerouslySetInnerHTML={{ __html: stylesheet }} />
			</head>
			<body>
				<AppBrowserEffects />
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	)
}

function UnauthorizedAgentPrompt() {
	const pathname = useLocation({ select: (location) => location.pathname })
	return (
		<ErrorAgentPromptButton
			prompt={buildUnauthorizedErrorAgentPrompt({ path: pathname })}
		/>
	)
}

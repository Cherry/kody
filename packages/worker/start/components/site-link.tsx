/** @jsxImportSource @emotion/react */
import { Link, useRouter } from '@tanstack/react-router'
import { type ComponentProps } from 'react'
import { actionPagePaths } from '../action-pages.ts'

/** Protocol handshakes and non-page endpoints use document navigation. */
export function SiteLink({
	href,
	children,
	preload,
	...props
}: ComponentProps<'a'> & {
	preload?: false | 'intent' | 'viewport' | 'render'
}) {
	const router = useRouter()
	if (!href?.startsWith('/') || href.startsWith('//')) {
		return (
			<a href={href} {...props}>
				{children}
			</a>
		)
	}
	const destination = new URL(href, 'https://kody.local')
	const [, params, route] = router.getMatchedRoutes(destination.pathname)
	const matchesPage = Boolean(route && !(route.path !== '/' && params['**']))
	return (
		<Link
			to={href}
			// Section navigation supplies its own current state for descendants.
			// Ordinary links should not mark their parent URL as the current page.
			activeOptions={{ exact: true }}
			preload={actionPagePaths.has(destination.pathname) ? false : preload}
			reloadDocument={
				destination.pathname.startsWith('/oauth/') || !matchesPage
			}
			{...props}
		>
			{children}
		</Link>
	)
}

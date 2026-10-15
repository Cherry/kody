/** @jsxImportSource @emotion/react */
import { createLink, useRouter } from '@tanstack/react-router'
import { forwardRef, type ComponentProps } from 'react'

// Router supplies aria-current="page" for exact active URLs. Section and wizard
// links can have a more specific current state, which belongs to their caller.
const RouterAnchor = createLink(
	forwardRef<
		HTMLAnchorElement,
		ComponentProps<'a'> & {
			current?: ComponentProps<'a'>['aria-current']
		}
	>(function RouterAnchor({ current, children, ...props }, ref) {
		return (
			<a {...props} ref={ref} aria-current={current ?? props['aria-current']}>
				{children}
			</a>
		)
	}),
)

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
		<RouterAnchor
			to={href}
			current={props['aria-current']}
			// Section navigation supplies its own current state for descendants.
			// Ordinary links should not mark their parent URL as the current page.
			activeOptions={{ exact: true }}
			preload={route?.options.preload === false ? false : preload}
			reloadDocument={
				destination.pathname.startsWith('/oauth/') || !matchesPage
			}
			{...props}
		>
			{children}
		</RouterAnchor>
	)
}

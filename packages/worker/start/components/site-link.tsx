/** @jsxImportSource @emotion/react */
import { linkNavigation } from '../link-navigation.ts'
import { createLink, useRouter } from '@tanstack/react-router'
import { forwardRef, type ComponentProps } from 'react'

// Router supplies aria-current="page" for exact active URLs. Section and wizard
// links can have a more specific current state, which belongs to their caller.
const RouterAnchor = createLink(
	forwardRef<
		HTMLAnchorElement,
		ComponentProps<'a'> & {
			current?: ComponentProps<'a'>['aria-current']
			documentHref?: string
		}
	>(function RouterAnchor({ current, documentHref, children, ...props }, ref) {
		return (
			<a
				{...props}
				href={documentHref ?? props.href}
				ref={ref}
				aria-current={current ?? props['aria-current']}
			>
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
	if (
		!href?.startsWith('/') ||
		href.startsWith('//') ||
		(props.download !== undefined && props.download !== false)
	) {
		return (
			<a href={href} {...props}>
				{children}
			</a>
		)
	}
	const destination = new URL(href, 'https://kody.local')
	const navigation = linkNavigation(router, destination.pathname)
	return (
		<RouterAnchor
			to={destination.pathname}
			search={router.options.parseSearch!(destination.search)}
			hash={destination.hash.slice(1)}
			// Protocol URLs carry opaque query values, preserve their browser href.
			documentHref={navigation.reloadDocument ? href : undefined}
			current={props['aria-current']}
			// Section navigation supplies its own current state for descendants.
			// Ordinary links should not mark their parent URL as the current page.
			activeOptions={{ exact: true }}
			preload={navigation.preload === false ? false : preload}
			reloadDocument={navigation.reloadDocument}
			{...props}
		>
			{children}
		</RouterAnchor>
	)
}

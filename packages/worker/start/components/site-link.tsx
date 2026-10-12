/** @jsxImportSource @emotion/react */
import { Link } from '@tanstack/react-router'
import { type ComponentProps } from 'react'
import { actionPagePaths } from '../action-pages.ts'
import { isMigratedPathname } from '../migrated-routes.ts'

/** Protocol handshakes and non-page endpoints use document navigation. */
export function SiteLink({ href, children, ...props }: ComponentProps<'a'>) {
	if (!href?.startsWith('/') || href.startsWith('//')) {
		return (
			<a href={href} {...props}>
				{children}
			</a>
		)
	}
	const destination = new URL(href, 'https://kody.local')
	return (
		<Link
			to={href}
			preload={actionPagePaths.has(destination.pathname) ? false : undefined}
			reloadDocument={
				destination.pathname.startsWith('/oauth/') ||
				!isMigratedPathname(destination.pathname)
			}
			{...props}
		>
			{children}
		</Link>
	)
}

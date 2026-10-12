import { type CSSObject } from '@emotion/react'
import { createMatcher } from 'remix/route-pattern/match'
import { routes } from '#universal/routes.ts'
import { isDocsPagePath } from '#universal/docs-nav.ts'
import { isPackageFilesPathname } from '#universal/package-files.ts'
import { isProfilePathname } from '#universal/profile-path.ts'
import { getSlugFromPathname } from '#client/routes/blog-post-path.ts'
import { mq, spacing, typography } from '#universal/styles/tokens.ts'

const packageMatchers = [
	routes.communityDetail,
	routes.communityPackage,
	routes.communityPackageSettings,
].map((route) => createMatcher(route.pattern))

function appPageOwnsGutters(pathname: string, illustratedError: boolean) {
	return (
		illustratedError ||
		[
			'/404',
			'/500',
			'/',
			'/pricing',
			'/faq',
			'/case-studies',
			'/blog',
			'/community',
			'/onboarding',
		].includes(pathname) ||
		pathname.startsWith('/onboarding/step-') ||
		isDocsPagePath(pathname) ||
		isProfilePathname(pathname) ||
		isPackageFilesPathname(pathname) ||
		getSlugFromPathname(pathname) !== null ||
		packageMatchers.some(
			(matcher) =>
				matcher.match(new URL(pathname, 'https://kody.local')) !== null,
		)
	)
}

export const appFrameCss: CSSObject = {
	width: '100%',
	minHeight: '100vh',
	display: 'flex',
	flexDirection: 'column',
	fontFamily: typography.fontFamily,
	boxSizing: 'border-box',
	overflowX: 'clip',
}

export function appMainCss(
	pathname: string,
	illustratedError: boolean,
): CSSObject {
	const auth = pathname === '/login' || pathname === '/signup'
	return {
		width: '100%',
		boxSizing: 'border-box',
		flex: 1,
		viewTransitionName: 'page',
		...(auth
			? { display: 'grid' }
			: appPageOwnsGutters(pathname, illustratedError)
				? {}
				: {
						padding: `${spacing.lg} ${spacing.xl} ${spacing.sm}`,
						[mq.tablet]: { padding: `${spacing.sm} ${spacing.sm} 0` },
						[mq.mobile]: {
							padding: `${spacing.md} ${spacing.md} ${spacing.sm}`,
						},
					}),
	}
}

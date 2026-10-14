import { type CSSObject } from '@emotion/react'
import { acquisitionPageSummaries } from '#universal/acquisition/metadata.ts'
import { isDocsPagePath } from '#universal/docs-nav.ts'
import { isPackageDetailPathname } from '#universal/package-files.ts'
import { isProfilePathname } from '#universal/profile-path.ts'
import { getSlugFromPathname } from '#client/routes/blog-post-path.ts'
import { mq, spacing, typography } from '#universal/styles/tokens.ts'

function appPageOwnsGutters(pathname: string, illustratedError: boolean) {
	return (
		illustratedError ||
		[
			'/404',
			'/500',
			'/',
			'/features',
			'/features/memory',
			'/features/secrets',
			'/features/packages',
			'/features/triggers',
			'/features/integrations',
			'/features/apps',
			'/for/business',
			'/pricing',
			'/faq',
			'/case-studies',
			'/blog',
			'/community',
			'/onboarding',
		].includes(pathname) ||
		acquisitionPageSummaries.some((page) => page.path === pathname) ||
		pathname.startsWith('/onboarding/step-') ||
		isDocsPagePath(pathname) ||
		isProfilePathname(pathname) ||
		isPackageDetailPathname(pathname) ||
		getSlugFromPathname(pathname) !== null
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
				: mainGutterPaddingCss),
	}
}

export const mainGutterPaddingCss: CSSObject = {
	padding: `${spacing.lg} ${spacing.xl} ${spacing.sm}`,
	[mq.tablet]: { padding: `${spacing.sm} ${spacing.sm} 0` },
	[mq.mobile]: { padding: `${spacing.md} ${spacing.md} ${spacing.sm}` },
}

import { isOnboardingPagePath } from './onboarding-process.ts'
import { isSamePackageRepoChromeHref } from './package-files.ts'
import { isProfilePathname } from './profile-path.ts'

/**
 * Areas whose pages sit inside a persistent shell (a sticky rail beside the
 * content). Moving between them is tab switching, not page-to-page
 * navigation: it is frequent, the chrome around the content does not change,
 * and the rail is a full-height element whose box tracks the page, so a
 * transition would scale its snapshot between two different heights and the
 * rail would visibly squash. These navigations swap instantly.
 *
 * `/docs` is the same kind of shell: the sidebar lives inside `<main>`
 * (`view-transition-name: page`), so a page transition would fade and slide
 * unchanged nav chrome on every guide click.
 */
const shellAreas = ['/account', '/admin', '/docs']

/**
 * Live persistent-shell chrome. Present only while a shell page is on
 * screen, account/admin rail or the docs sidebar.
 */
export const persistentShellNavSelector = '[data-account-nav], [data-docs-nav]'

function isWithinArea(pathname: string, area: string) {
	return pathname === area || pathname.startsWith(`${area}/`)
}

function pathnameOf(path: string) {
	return path.split('?')[0] ?? ''
}

function isShellAreaPath(path: string) {
	const pathname = pathnameOf(path)
	return shellAreas.some((area) => isWithinArea(pathname, area))
}

/** Both paths may carry a search string; only the pathname decides the area. */
function isSameShellAreaNavigation(from: string | null, to: string) {
	if (!from) return false
	return shellAreas.some(
		(area) =>
			isWithinArea(pathnameOf(from), area) &&
			isWithinArea(pathnameOf(to), area),
	)
}

function isSameOnboardingNavigation(from: string | null, to: string) {
	if (!from) return isOnboardingPagePath(pathnameOf(to))
	return (
		isOnboardingPagePath(pathnameOf(from)) &&
		isOnboardingPagePath(pathnameOf(to))
	)
}

function isSameProfilePathnameNavigation(from: string | null, to: string) {
	if (from == null) return false
	const fromPathname = pathnameOf(from)
	return fromPathname === pathnameOf(to) && isProfilePathname(fromPathname)
}

/**
 * View transitions are for real page changes. Tab switches inside a
 * persistent shell stay instant, even when `from` was never recorded
 * (first click after a full document load used to animate because
 * `lastNotifiedDocumentPath` was still null).
 */
export function shouldUseViewTransition(input: {
	from: string | null
	to: string
	canStart: boolean
	prefersReducedMotion: boolean
	hasPersistentShell?: boolean
}) {
	if (!input.canStart) return false
	if (input.prefersReducedMotion) return false
	if (input.from === input.to) return false
	if (isSameShellAreaNavigation(input.from, input.to)) return false
	if (isSameOnboardingNavigation(input.from, input.to)) return false
	if (isSameProfilePathnameNavigation(input.from, input.to)) return false
	if (input.from != null && isSamePackageRepoChromeHref(input.from, input.to)) {
		return false
	}
	// Full document load never recorded `from`. If the rail is already on
	// screen and the destination is still a shell page, this is a tab click.
	if (
		input.from === null &&
		input.hasPersistentShell &&
		isShellAreaPath(input.to)
	) {
		return false
	}
	return true
}

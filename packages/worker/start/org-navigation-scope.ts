import { isOrgOwnedAccountSection } from '#universal/org-pages.ts'

/** Use Router's matched resource and decoded params, never a second URL matcher. */
export function orgNavigationScope(
	matches: ReadonlyArray<{ routeId: unknown; params: unknown }>,
) {
	for (const match of [...matches].reverse()) {
		if (
			typeof match.routeId !== 'string' ||
			!match.routeId.startsWith('/@{$orgSlug}_/-/')
		)
			continue
		if (
			!match.params ||
			typeof match.params !== 'object' ||
			!('orgSlug' in match.params)
		)
			continue
		const orgSlug = match.params.orgSlug
		if (typeof orgSlug !== 'string') continue
		const section =
			match.routeId.split('/-/')[1]?.split('/')[0]?.replace(/_$/, '') ?? ''
		return {
			orgSlug,
			section: isOrgOwnedAccountSection(section) ? section : undefined,
		}
	}
	return undefined
}

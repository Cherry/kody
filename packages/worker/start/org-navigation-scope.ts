import { isOrgOwnedAccountSection } from '#universal/org-pages.ts'

/** Use Router's matched resource and decoded params, never a second URL matcher. */
export function orgNavigationScope(
	matches: ReadonlyArray<{ routeId: string; params: object }>,
) {
	for (const match of [...matches].reverse()) {
		if (!match.routeId.startsWith('/@{$orgSlug}_/-/')) continue
		const orgSlug = (match.params as { orgSlug?: unknown }).orgSlug
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

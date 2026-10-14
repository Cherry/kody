/**
 * Single-decision pages (approvals) that render with only the brand and the
 * account menu: no site nav, no workspace rail, no footer.
 */
export function isFocusedPagePathname(pathname: string) {
	return (
		/^\/(?:@[^/]+\/[^/]+|account\/packages\/[^/]+)\/approve-capabilities\/?$/.test(
			pathname,
		) || /^\/@[^/]+\/-\/approvals\/[^/]+\/?$/.test(pathname)
	)
}

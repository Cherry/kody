/** HTML variants whose original routes also serve Markdown by Accept header. */
export function isNegotiatedDocumentPath(pathname: string) {
	if (pathname === '/') return true
	if (/\.(?:json|md)\/?$/.test(pathname)) return false
	return (
		/^\/docs(?:\/[^/]+)?\/?$/.test(pathname) ||
		/^\/blog\/[^/]+\/?$/.test(pathname)
	)
}

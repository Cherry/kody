import { type Page, type Request } from './playwright-utils.ts'

/** Page loaders accept the destination as a string. Verification accepts an
 * object with pathname, which must not count as a payload read. */
export function requestNamesDestination(
	request: Pick<Request, 'url' | 'method'>,
	destination: string,
) {
	const url = new URL(request.url())
	if (request.method() !== 'GET' || !url.pathname.startsWith('/_serverFn/'))
		return false
	const payload = url.searchParams.get('payload')
	if (!payload) return false
	try {
		const serialized = JSON.parse(payload)
		// Start serializes { data, context } with Seroval. Read only the root
		// data property, never unrelated nested strings in context or guards.
		const properties = serialized?.t?.p
		const index = Array.isArray(properties?.k)
			? properties.k.indexOf('data')
			: -1
		const data = index >= 0 ? properties?.v?.[index] : undefined
		return data?.t === 1 && data.s === destination
	} catch {
		return false
	}
}

export function waitForDestinationRead(page: Page, destination: string) {
	return page.waitForResponse((response) =>
		requestNamesDestination(response.request(), destination),
	)
}

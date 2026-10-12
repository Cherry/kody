import { actionPagePaths } from './action-pages.ts'

// Start's Vite plugin replaces this expression in both its dispatcher and ours.
// Keep the declaration module-local because Workers do not use Node globals.
declare const process: { env: { TSS_SERVER_FN_BASE?: string } }

/** Token links mutate on GET, and must never be consumed by link checkers. */
export async function dispatchDocumentMethod(input: {
	request: Request
	readDestinationHead: () => Promise<Response>
	render: () => Promise<Response>
}): Promise<Response> {
	const pathname = new URL(input.request.url).pathname
	// This exact namespace is Start's native RPC protocol, not a document.
	const serverFnBase = process.env.TSS_SERVER_FN_BASE
	if (serverFnBase && pathname.startsWith(serverFnBase)) return input.render()
	if (input.request.method !== 'GET' && input.request.method !== 'HEAD')
		return new Response(null, {
			status: 405,
			headers: {
				Allow:
					actionPagePaths.has(pathname) &&
					pathname !== '/verify-email-destination'
						? 'GET'
						: 'GET, HEAD',
			},
		})
	if (input.request.method === 'HEAD') {
		if (pathname === '/verify-email-destination')
			return input.readDestinationHead()
		if (actionPagePaths.has(pathname))
			return new Response(null, { status: 405, headers: { Allow: 'GET' } })
	}
	return input.render()
}

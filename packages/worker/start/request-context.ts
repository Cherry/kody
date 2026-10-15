import '@tanstack/router-core'

type KodyStartRequestContext = {
	nonce: string
	documentFailure?: { status: 403 | 404 | 500 }
}

declare module '@tanstack/router-core' {
	interface Register {
		server: { requestContext: KodyStartRequestContext }
	}
}

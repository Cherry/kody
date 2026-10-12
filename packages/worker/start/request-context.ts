import '@tanstack/router-core'
import { type OAuthPageOptions } from '#universal/oauth-page.ts'

type KodyStartRequestContext = {
	nonce: string
	oauthPage?: OAuthPageOptions & { href: string }
}

declare module '@tanstack/router-core' {
	interface Register {
		server: { requestContext: KodyStartRequestContext }
	}
}

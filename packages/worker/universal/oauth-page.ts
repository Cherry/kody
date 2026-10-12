import { type OAuthAuthorizeLoaderData } from './loader-data.ts'

export type OAuthPageOptions = {
	status?: number
	loaderData?: { oauthAuthorize: OAuthAuthorizeLoaderData }
	setCookie?: string | null
}

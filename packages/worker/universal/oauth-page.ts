import {
	type AuthProvidersLoaderData,
	type OAuthAuthorizeLoaderData,
} from './loader-data.ts'

export type OAuthPageOptions = {
	status?: number
	loaderData?: {
		oauthAuthorize: OAuthAuthorizeLoaderData
		authProviders?: AuthProvidersLoaderData
	}
	setCookie?: string | null
}

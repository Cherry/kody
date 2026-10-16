import * as oauth from 'oauth4webapi'
import {
	cliClientMetadataUrl,
	cliRedirectUrl,
	defaultScopes,
} from './defaults.js'
import { orgSlugFromFlag } from './org-slug.js'

export type OAuthTokenSet = {
	accessToken: string
	refreshToken?: string
	tokenType: string
	expiresIn?: number
	scope?: string
	issuer: string
}

function fetchFrom(fetchFn: typeof fetch | undefined): typeof fetch {
	return fetchFn ?? fetch
}

function discoveryOptions(issuer: URL, fetchFn: typeof fetch | undefined) {
	return {
		algorithm: 'oauth2' as const,
		[oauth.customFetch]: fetchFrom(fetchFn),
		...(issuer.protocol === 'http:'
			? { [oauth.allowInsecureRequests]: true }
			: {}),
	}
}

export async function discoverCliAuthorizationServer(input: {
	issuer: URL
	fetchFn?: typeof fetch
}): Promise<oauth.AuthorizationServer> {
	const options = discoveryOptions(input.issuer, input.fetchFn)
	const response = await oauth.discoveryRequest(input.issuer, options)
	return oauth.processDiscoveryResponse(input.issuer, response)
}

export function cliOAuthClient(mcpUrl: string): oauth.Client {
	return {
		client_id: cliClientMetadataUrl(mcpUrl),
		token_endpoint_auth_method: 'none',
	}
}

export async function buildCliAuthorizationUrl(input: {
	authorizationServer: oauth.AuthorizationServer
	mcpUrl: string
	redirectUri?: URL
	state: string
	codeChallenge: string
	org?: string
	scope?: string
}): Promise<URL> {
	if (!input.authorizationServer.authorization_endpoint) {
		throw new Error('OAuth authorization server has no authorization_endpoint.')
	}
	const url = new URL(input.authorizationServer.authorization_endpoint)
	url.searchParams.set('client_id', cliOAuthClient(input.mcpUrl).client_id)
	url.searchParams.set(
		'redirect_uri',
		(input.redirectUri ?? cliRedirectUrl()).href,
	)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('scope', input.scope ?? defaultScopes.join(' '))
	url.searchParams.set('code_challenge', input.codeChallenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('state', input.state)
	url.searchParams.set('resource', input.mcpUrl)
	if (input.org !== undefined) {
		url.searchParams.set('org', orgSlugFromFlag(input.org))
	}
	return url
}

function insecure(issuer: string) {
	return new URL(issuer).protocol === 'http:'
		? { [oauth.allowInsecureRequests]: true }
		: {}
}

export async function exchangeAuthorizationCode(input: {
	authorizationServer: oauth.AuthorizationServer
	mcpUrl: string
	redirectUri: URL
	callback: URL
	state: string
	codeVerifier: string
	fetchFn?: typeof fetch
}): Promise<OAuthTokenSet> {
	const client = cliOAuthClient(input.mcpUrl)
	const params = oauth.validateAuthResponse(
		input.authorizationServer,
		client,
		input.callback,
		input.state,
	)
	const resource = new URLSearchParams()
	resource.set('resource', input.mcpUrl)
	const response = await oauth.authorizationCodeGrantRequest(
		input.authorizationServer,
		client,
		oauth.None(),
		params,
		input.redirectUri.href,
		input.codeVerifier,
		{
			...insecure(input.authorizationServer.issuer),
			[oauth.customFetch]: fetchFrom(input.fetchFn),
			additionalParameters: resource,
		},
	)
	const tokens = await oauth.processAuthorizationCodeResponse(
		input.authorizationServer,
		client,
		response,
	)
	return tokenSetFromResult(input.authorizationServer.issuer, tokens)
}

export async function refreshOAuthTokens(input: {
	issuer: string
	mcpUrl: string
	refreshToken: string
	fetchFn?: typeof fetch
}): Promise<OAuthTokenSet> {
	const issuer = new URL(input.issuer)
	const authorizationServer = await discoverCliAuthorizationServer({
		issuer,
		fetchFn: input.fetchFn,
	})
	const client = cliOAuthClient(input.mcpUrl)
	const response = await oauth.refreshTokenGrantRequest(
		authorizationServer,
		client,
		oauth.None(),
		input.refreshToken,
		{
			...insecure(authorizationServer.issuer),
			[oauth.customFetch]: fetchFrom(input.fetchFn),
		},
	)
	const tokens = await oauth.processRefreshTokenResponse(
		authorizationServer,
		client,
		response,
	)
	return tokenSetFromResult(authorizationServer.issuer, tokens)
}

function tokenSetFromResult(
	issuer: string,
	tokens: oauth.TokenEndpointResponse,
): OAuthTokenSet {
	return {
		accessToken: tokens.access_token,
		...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
		tokenType: tokens.token_type ?? 'bearer',
		...(typeof tokens.expires_in === 'number'
			? { expiresIn: tokens.expires_in }
			: {}),
		...(tokens.scope ? { scope: tokens.scope } : {}),
		issuer,
	}
}

export async function createPkcePair(): Promise<{
	verifier: string
	challenge: string
}> {
	const verifier = oauth.generateRandomCodeVerifier()
	const challenge = await oauth.calculatePKCECodeChallenge(verifier)
	return { verifier, challenge }
}

import {
	cliClientMetadataUrl,
	cliClientUri,
	cliName,
	cliRedirectUrl,
	defaultScopes,
} from './defaults.js'
import { orgSlugFromFlag } from './org-slug.js'
import { type StoredCredentials } from './store.js'

export { orgSlugFromFlag } from './org-slug.js'

export type CliClientMetadata = {
	client_name: string
	client_uri: string
	redirect_uris: Array<string>
	grant_types: Array<string>
	response_types: Array<string>
	token_endpoint_auth_method: 'none'
	application_type: 'native'
	scope: string
}

export function buildCliClientMetadata(): CliClientMetadata {
	return {
		client_name: cliName,
		client_uri: cliClientUri,
		redirect_uris: [cliRedirectUrl().href],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'none',
		application_type: 'native',
		scope: defaultScopes.join(' '),
	}
}

/** Issuer stamp restored from durable CLI storage. */
export function issuerFromStoredCredentials(
	credentials: StoredCredentials,
): string {
	const recorded = credentials.authorizationServerUrl?.trim()
	if (recorded) return recorded
	return new URL(credentials.mcpUrl).origin
}

export function cliMetadataUrl(mcpUrl: string): string {
	return cliClientMetadataUrl(mcpUrl)
}

import { discoverLoginIdentity } from './discover-login-identity.js'
import { orgSlugFromFlag } from './org-slug.js'

/**
 * Resolve the org slug bound to a device API token via `GET /v1/me`.
 */
export async function discoverOrgSlugFromAccessToken(input: {
	mcpUrl: string
	accessToken: string
	apiUrl?: string
	fetchFn?: typeof fetch
}): Promise<string> {
	try {
		const identity = await discoverLoginIdentity(input)
		return orgSlugFromFlag(identity.org)
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'metaGetCurrentUser failed'
		if (message.startsWith('Could not determine the organization')) throw error
		throw new Error(
			`Could not determine the organization for this login (${message}).`,
		)
	}
}

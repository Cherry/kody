import { handleRequest } from './http-entry.ts'
import { type OAuthPageOptions } from '#universal/oauth-page.ts'

export function renderOAuthPage(
	request: Request,
	env: Env,
	options: OAuthPageOptions = {},
) {
	return handleRequest(request, env, undefined, options)
}

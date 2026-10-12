import { renderAppPage } from '#app/ssr-render.tsx'
import { type OAuthPageOptions } from '#universal/oauth-page.ts'

export function renderOAuthPage(
	request: Request,
	env: Env,
	options: OAuthPageOptions = {},
) {
	return renderAppPage({
		request,
		env,
		status: options.status ?? 200,
		loaderData: options.loaderData,
		extraSetCookies: options.setCookie ? [options.setCookie] : undefined,
	})
}

import { type Action } from 'remix/router'
import { requirePageSession } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadConnectOauthLoaderData } from './connect-oauth.ts'

export function createConnectOauthHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const requestUrl = new URL(request.url)
			const sessionRedirect = await requirePageSession(request)
			if (sessionRedirect) {
				return sessionRedirect
			}
			const connectOauth = await loadConnectOauthLoaderData(
				env,
				request,
				requestUrl,
			)
			return renderAppPage({
				request,
				env,
				loaderData: { connectOauth },
			})
		},
	} satisfies Action<typeof routes.connectOauth>
}

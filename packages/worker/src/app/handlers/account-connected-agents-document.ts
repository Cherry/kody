import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { parseAccountConnectionsPathname } from '#universal/account-connections.ts'
import { loadAccountConnectedAgentsData } from './account-connected-agents.ts'

/**
 * `/account/connections`, `/account/connections/new`, and
 * `/account/connections/new/:agent` share one payload; the client renders
 * each pathname as its own page (the list does not wrap the add views).
 * An unknown agent segment is a 404 page.
 */
export function createAccountConnectionsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }: { request: Request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const view = parseAccountConnectionsPathname(
				new URL(request.url).pathname,
			)
			if (!view) {
				return renderAppPage({
					request,
					env,
					title: 'Connection not found',
					notFound: true,
					status: 404,
				})
			}

			const accountConnectedAgents = await loadAccountConnectedAgentsData({
				env,
				requestUrl: request.url,
				user,
			})
			// Titles come from the document-head registry so SPA navigation
			// between the list, grid, and per-agent views agrees with SSR.
			return renderAppPage({
				request,
				env,
				loaderData: { accountConnectedAgents },
			})
		},
	}
}

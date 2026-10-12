import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadClientsPayload } from './account-mcp-oauth-clients.ts'

export function createAccountMcpOauthClientsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			return renderAppPage({
				request,
				env,
				title: 'MCP OAuth clients',
				loaderData: {
					accountMcpOauthClients: await loadClientsPayload(
						env.APP_DB,
						user.userId,
					),
				},
			})
		},
	} satisfies Action<typeof routes.accountMcpOauthClients>
}

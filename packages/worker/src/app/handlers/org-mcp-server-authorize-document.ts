import { type Action } from 'remix/router'
import { redirectToLogin } from '#app/auth-redirect.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import {
	loadConsentContext,
	isConsentRefusal,
	refusalStatus,
	buildConsentLoaderData,
} from './org-mcp-server-authorize.ts'

/**
 * The page every MCP server `authUrl` opens. It names the server, the
 * authorization server host, and the client mode, and sends nobody to the
 * provider until they click Continue.
 */
export function createOrgMcpServerAuthorizeHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const context = await loadConsentContext({ env, request, params })
			if (isConsentRefusal(context)) {
				if (context.kind === 'signed-out') return redirectToLogin(request)
				return renderAppPage({
					request,
					env,
					title: context.title,
					notFound: true,
					status: refusalStatus(context),
				})
			}
			return renderAppPage({
				request,
				env,
				title: `Authorize ${context.setting.name}`,
				loaderData: {
					mcpServerAuthorize: await buildConsentLoaderData({ env, context }),
				},
			})
		},
	} satisfies Action<typeof routes.orgMcpServerAuthorize>
}

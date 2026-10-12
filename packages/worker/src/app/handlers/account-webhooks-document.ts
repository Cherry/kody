import { loadAccountWebhooksData } from '#app/package-webhooks-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'

/**
 * Page handler for `/account/webhooks`: the cross-package index. Each row
 * deep-links into the owning package's settings, where the URL actions live.
 */
export function createAccountWebhooksHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }: { request: Request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}
			const accountWebhooks = await loadAccountWebhooksData({
				env,
				requestUrl: request.url,
				user,
			})
			return renderAppPage({
				request,
				env,
				title: 'Webhooks',
				loaderData: { accountWebhooks },
			})
		},
	}
}

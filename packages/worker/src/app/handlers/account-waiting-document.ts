import { waitUntil } from 'cloudflare:workers'
import { loadAccountWaitingData } from '#app/account-waiting-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'

export function createAccountWaitingHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }: { request: Request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const accountWaiting = await loadAccountWaitingData({
				env,
				user,
				waitUntil,
			})
			return renderAppPage({
				request,
				env,
				title: 'Waiting',
				loaderData: { accountWaiting },
			})
		},
	}
}

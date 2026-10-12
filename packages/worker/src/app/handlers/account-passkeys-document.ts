import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadPasskeysPayload } from './account-passkeys.ts'

export function createAccountPasskeysHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			// Embed the same payload the .json endpoint serves so the page
			// server-renders its real state instead of "Loading passkeys…"
			// plus a client fetch.
			return renderAppPage({
				request,
				env,
				title: 'Passkeys',
				loaderData: {
					accountPasskeys: await loadPasskeysPayload(env.APP_DB, user.userId),
				},
			})
		},
	} satisfies Action<typeof routes.accountPasskeys>
}

import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadTwoFactorStatus } from './account-two-factor.ts'

export function createAccountTwoFactorHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			// Embed the same payload the .json endpoint serves so the page
			// server-renders its real state instead of "Loading two-factor
			// status…" plus a client fetch.
			return renderAppPage({
				request,
				env,
				title: 'Two-factor authentication',
				loaderData: {
					accountTwoFactor: await loadTwoFactorStatus(env.APP_DB, user.userId),
				},
			})
		},
	} satisfies Action<typeof routes.accountTwoFactor>
}

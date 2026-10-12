import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadAccountUsagePageResult } from '../account-usage-page.ts'

export function createAccountUsageHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const accountUsage = await loadAccountUsagePageResult(env, request, user)
			if (accountUsage instanceof Response) return accountUsage
			return renderAppPage({
				request,
				env,
				title: 'Usage',
				loaderData: { accountUsage },
			})
		},
	} satisfies Action<typeof routes.accountUsage>
}

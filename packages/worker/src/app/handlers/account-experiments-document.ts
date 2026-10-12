import { type Action } from 'remix/router'
import { loadAccountExperimentsData } from '#app/account-experiments-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'

export function createAccountExperimentsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const accountExperiments = await loadAccountExperimentsData({
				db: env.APP_DB,
				userId: user.userId,
			})
			return renderAppPage({
				request,
				env,
				title: 'Experiments',
				loaderData: { accountExperiments },
			})
		},
	} satisfies Action<typeof routes.accountExperiments>
}

import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { routes } from '#universal/routes.ts'
import { loadAccountOrganizationsData } from './account-organizations.ts'

export function createAccountOrganizationsNewHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) return user
			const url = new URL(request.url)
			return renderAppPage({
				request,
				env,
				title: 'Create organization',
				loaderData: {
					accountOrganizationsNew: {
						ok: true,
						error: url.searchParams.get('error'),
						draft: {
							displayName: url.searchParams.get('displayName') ?? '',
							slug: url.searchParams.get('slug') ?? '',
						},
					},
				},
			})
		},
	} satisfies Action<typeof routes.accountOrganizationsNew>
}

export function createAccountOrganizationsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) return user
			return renderAppPage({
				request,
				env,
				title: 'Organizations',
				loaderData: {
					accountOrganizations: await loadAccountOrganizationsData(
						env,
						user,
						request,
					),
				},
			})
		},
	} satisfies Action<typeof routes.accountOrganizations>
}

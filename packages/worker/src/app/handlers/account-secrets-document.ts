import { loadAccountSecretsData } from '#app/account-secrets-data.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { accountAliasPath } from '#universal/org-pages.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'

export function createAccountSecretsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }: { request: Request }) {
			const requestUrl = new URL(request.url)
			// Prefill agent links use the focused /connect/secret-set page.
			// Bare /account/secrets/new stays on the account list editor.
			if (
				accountAliasPath(requestUrl.pathname) === '/account/secrets/new' &&
				requestUrl.searchParams.get('name')?.trim()
			) {
				const redirectUrl = new URL(
					`/connect/secret-set${requestUrl.search}`,
					requestUrl.origin,
				)
				return Response.redirect(redirectUrl, 302)
			}

			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const accountSecrets = await loadAccountSecretsData({
				request,
				env,
				user,
			})
			return renderAppPage({
				request,
				env,
				title: 'Secrets',
				loaderData: { accountSecrets },
			})
		},
	}
}

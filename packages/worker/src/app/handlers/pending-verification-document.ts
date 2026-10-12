import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { resolvePostVerificationRedirect } from './pending-verification.ts'

export function createPendingVerificationHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			if (user.emailVerified) {
				return Response.redirect(resolvePostVerificationRedirect(request), 302)
			}

			return renderAppPage({
				request,
				env,
				title: 'Verify your email',
				loaderData: {
					pendingVerification: {
						ok: true,
						email: user.email,
						emailVerificationDelivery: user.emailVerificationDelivery ?? null,
					},
				},
			})
		},
	} satisfies Action<typeof routes.pendingVerification>
}

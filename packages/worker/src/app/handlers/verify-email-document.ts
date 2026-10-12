import { type Action } from 'remix/router'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadVerifyEmailPage } from './verify-email.ts'

export function createVerifyEmailHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const result = await loadVerifyEmailPage(request, env)
			return renderAppPage({ request, env, ...result })
		},
	} satisfies Action<typeof routes.verifyEmail>
}

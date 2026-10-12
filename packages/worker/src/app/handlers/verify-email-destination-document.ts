import { type Action } from 'remix/router'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadVerifyEmailDestinationPage } from './verify-email-destination.ts'

export function createVerifyEmailDestinationHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const result = await loadVerifyEmailDestinationPage(request, env)
			if (result instanceof Response) return result
			return renderAppPage({ request, env, ...result })
		},
	} satisfies Action<typeof routes.verifyEmailDestination>
}

import { type Action } from 'remix/router'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { loadUnsubscribeTipsPage } from './unsubscribe-tips.ts'

export function createUnsubscribeTipsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const result = await loadUnsubscribeTipsPage(request, env)
			if (result instanceof Response) return result
			return renderAppPage({ request, env, ...result })
		},
	} satisfies Action<typeof routes.unsubscribeTips>
}

import { type Action } from 'remix/router'
import { type routes } from '#universal/routes.ts'
import { authenticateWebsite } from '#worker/identity/auth-operations.ts'
export function createAuthHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, url }) {
			let body: Record<string, unknown>
			try {
				body = await request.json()
			} catch {
				return Response.json(
					{ error: 'Invalid JSON payload.' },
					{ status: 400 },
				)
			}
			const result = await authenticateWebsite({ env, request, url, body })
			return Response.json(result.data, {
				status: result.status,
				headers: result.headers,
			})
		},
	} satisfies Action<typeof routes.auth>
}

import { loadAccountJobsData } from '#app/account-jobs-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'
import { mutateAccountJobs } from './account-jobs.ts'
export * from './account-jobs.ts'
export function testAccountJobsApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				const serverTiming: Array<ServerTimingEntry> = []
				return operationResult(
					await loadAccountJobsData({
						env,
						request,
						user,
						serverTiming,
					}),
				)
			}

			if (request.method !== 'POST') {
				return operationResult({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			if (!body || typeof body !== 'object') {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}

			const result = await mutateAccountJobs({
				request,
				env,
				user,
				body: body as Record<string, unknown>,
			})
			return operationResult(result.data, result.status)
		},
	}
}

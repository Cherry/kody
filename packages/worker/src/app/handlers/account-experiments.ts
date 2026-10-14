import {
	loadAccountExperimentsData,
	setExperimentsOptIn,
} from '#app/account-experiments-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'

function readExperimentsOptInBody(body: object): boolean | null {
	if (!('experimentsOptIn' in body)) return null
	const value = (body as { experimentsOptIn: unknown }).experimentsOptIn
	if (typeof value !== 'boolean') return null
	return value
}

export async function mutateAccountExperiments({
	request,
	env,
	user,
	body,
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: Record<string, unknown>
}) {
	const experimentsOptIn = readExperimentsOptInBody(body)
	if (experimentsOptIn === null) {
		return operationResult(
			{ ok: false, error: 'experimentsOptIn must be a boolean.' },
			400,
		)
	}

	await setExperimentsOptIn(env.APP_DB, {
		userId: user.userId,
		enabled: experimentsOptIn,
	})

	const requestIp = getRequestIp(request) ?? undefined
	void logAuditEvent({
		db: auditDatabaseFromEnv(env),
		category: 'account',
		action: experimentsOptIn ? 'experiments_opt_in' : 'experiments_opt_out',
		result: 'success',
		email: user.email,
		ip: requestIp,
		path: new URL(request.url).pathname,
		reason: `experiments_opt_in=${experimentsOptIn}`,
	})

	return operationResult(
		await loadAccountExperimentsData({
			db: env.APP_DB,
			userId: user.userId,
		}),
	)
}

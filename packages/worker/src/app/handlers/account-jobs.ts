import {
	loadAccountJobsData,
	type AccountJobsLoaderData,
} from '#app/account-jobs-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import { createMcpCallerContext } from '#mcp/context.ts'
import { getAppBaseUrl } from '#worker/app-base-url.ts'
import { runJobNowViaManager } from '#worker/jobs/manager-client.ts'
import { updateJob } from '#worker/jobs/service.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

export function readPathJobId(params: unknown) {
	if (
		typeof params === 'object' &&
		params !== null &&
		'jobId' in params &&
		typeof params.jobId === 'string'
	) {
		return params.jobId
	}
	return undefined
}

async function reloadJobsPayload(input: {
	env: Env
	request: Request
	user: AuthenticatedUser
	selectedJobId?: string | null
}): Promise<AccountJobsLoaderData> {
	const requestUrl = new URL(input.request.url)
	if (input.selectedJobId) {
		requestUrl.searchParams.set('selected', input.selectedJobId)
	} else {
		requestUrl.searchParams.delete('selected')
	}
	// Build a fresh GET-shaped Request so we do not reuse a consumed POST body.
	return await loadAccountJobsData({
		env: input.env,
		request: new Request(requestUrl.toString(), {
			method: 'GET',
			headers: { Accept: 'application/json' },
		}),
		user: input.user,
	})
}

function requireJobId(body: object) {
	const id = readTrimmedStringOrEmpty(body, 'id')
	if (!id) {
		throw new Error('Job id is required.')
	}
	return id
}

function buildCallerContext(input: {
	env: Env
	request: Request
	user: AuthenticatedUser
}) {
	return createMcpCallerContext({
		baseUrl: getAppBaseUrl({
			env: input.env,
			requestUrl: input.request.url,
		}),
		source: { kind: 'session' },
		executionOrigin: 'interactive',
		user: input.user.mcpUser,
		orgBinding: {
			org: input.user.request.org,
			role: input.user.request.membership?.role ?? null,
		},
	})
}

async function handleSetKillSwitchAction(input: {
	env: Env
	user: AuthenticatedUser
	body: object
	request: Request
}) {
	const id = requireJobId(input.body)
	const killSwitchEnabled = readBoolean(input.body, 'killSwitchEnabled')
	if (killSwitchEnabled === null) {
		throw new Error('killSwitchEnabled must be a boolean.')
	}
	await updateJob({
		env: input.env,
		callerContext: buildCallerContext(input),
		body: { id, killSwitchEnabled },
	})
	return operationResult(
		await reloadJobsPayload({
			...input,
			selectedJobId: id,
		}),
	)
}

async function handleRunNowAction(input: {
	env: Env
	user: AuthenticatedUser
	body: object
	request: Request
}) {
	const id = requireJobId(input.body)
	const result = await runJobNowViaManager({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		jobId: id,
		callerContext: buildCallerContext(input),
	})
	const payload = await reloadJobsPayload({
		...input,
		selectedJobId: result.deletedAfterRun ? null : id,
	})
	return operationResult({
		...payload,
		runNow: {
			ok: result.execution.ok,
			error: result.execution.ok ? null : result.execution.error,
			deletedAfterRun: result.deletedAfterRun,
		},
	})
}

function readBoolean(body: object, key: string) {
	const value = (body as Record<string, unknown>)[key]
	return typeof value === 'boolean' ? value : null
}

export async function mutateAccountJobs({
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
	const action = readTrimmedStringOrEmpty(body, 'action')
	try {
		if (action === 'set_kill_switch') {
			return await handleSetKillSwitchAction({ env, user, body, request })
		}
		if (action === 'run_now') {
			return await handleRunNowAction({ env, user, body, request })
		}
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Unable to update scheduled job.',
			},
			400,
		)
	}

	return operationResult({ ok: false, error: 'Invalid action.' }, 400)
}

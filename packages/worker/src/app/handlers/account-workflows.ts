import {
	loadAccountWorkflowsData,
	type AccountWorkflowsLoaderData,
} from '#app/account-workflows-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import { cancelWorkflowRunForUser } from '#worker/package-runtime/package-workflows.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

export function readPathWorkflowId(params: unknown) {
	if (
		typeof params === 'object' &&
		params !== null &&
		'workflowId' in params &&
		typeof params.workflowId === 'string'
	) {
		return params.workflowId
	}
	return undefined
}

async function reloadWorkflowsPayload(input: {
	env: Env
	request: Request
	user: AuthenticatedUser
	selectedWorkflowId?: string | null
}): Promise<AccountWorkflowsLoaderData> {
	const requestUrl = new URL(input.request.url)
	if (input.selectedWorkflowId) {
		requestUrl.searchParams.set('selected', input.selectedWorkflowId)
	} else {
		requestUrl.searchParams.delete('selected')
	}
	return await loadAccountWorkflowsData({
		env: input.env,
		request: new Request(requestUrl.toString(), {
			method: 'GET',
			headers: { Accept: 'application/json' },
		}),
		user: input.user,
	})
}

async function handleCancelAction(input: {
	env: Env
	user: AuthenticatedUser
	body: object
	request: Request
}) {
	const id = readTrimmedStringOrEmpty(input.body, 'id')
	if (!id) {
		throw new Error('Workflow run id is required.')
	}

	const result = await cancelWorkflowRunForUser({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		workflowRunId: id,
	})

	switch (result.outcome) {
		case 'not_found':
			throw new Error(
				`Workflow run "${id}" was not found for the current user.`,
			)
		case 'already_terminal':
		case 'cancelled': {
			const payload = await reloadWorkflowsPayload({
				...input,
				selectedWorkflowId: id,
			})
			return operationResult({
				...payload,
				cancel: {
					cancelled: result.outcome === 'cancelled',
					alreadyTerminal: result.outcome === 'already_terminal',
					status: result.run.status,
				},
			})
		}
		default: {
			const exhaustive: never = result
			throw new Error(
				`Unhandled cancelWorkflowRunForUser outcome: ${JSON.stringify(exhaustive)}`,
			)
		}
	}
}

export async function mutateAccountWorkflows({
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
		if (action === 'cancel') {
			return await handleCancelAction({ env, user, body, request })
		}
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Unable to update workflow run.',
			},
			400,
		)
	}

	return operationResult({ ok: false, error: 'Invalid action.' }, 400)
}

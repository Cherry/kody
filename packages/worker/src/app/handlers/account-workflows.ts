import {
	loadAccountWorkflowsData,
	type AccountWorkflowsLoaderData,
} from '#app/account-workflows-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { cancelWorkflowRunForUser } from '#worker/package-runtime/package-workflows.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

async function reloadWorkflowsPayload(input: {
	env: Env
	request: Request
	user: AuthenticatedUser
	selectedWorkflowId?: string | null
}): Promise<AccountWorkflowsLoaderData> {
	return await loadAccountWorkflowsData({
		env: input.env,
		user: input.user,
		selectedWorkflowId: input.selectedWorkflowId ?? null,
	})
}

export async function cancelAccountWorkflowRun(input: {
	env: Env
	user: AuthenticatedUser
	id: string
	request: Request
}) {
	const id = input.id.trim()
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

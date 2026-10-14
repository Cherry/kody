import {
	loadAccountValuesData,
	userScopedStorageContext,
} from '#app/account-values-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { deleteValue } from '#mcp/values/service.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

async function handleDeleteAction(input: {
	env: Env
	user: AuthenticatedUser
	name: string
}) {
	const name = input.name.trim()
	if (!name) {
		throw new Error('Value name is required.')
	}
	const deleted = await deleteValue({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		scope: 'user',
		storageContext: userScopedStorageContext,
		name,
	})
	if (!deleted) {
		return operationResult({ ok: false, error: 'Value not found.' }, 404)
	}
	return operationResult(
		await loadAccountValuesData({
			env: input.env,
			user: input.user,
			selectedValueId: null,
		}),
	)
}

export async function deleteAccountValueRecord({
	env,
	user,
	name,
}: {
	env: Env
	user: AuthenticatedUser
	request: Request
	name: string
}) {
	try {
		return await handleDeleteAction({ env, user, name })
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error ? error.message : 'Unable to update values.',
			},
			400,
		)
	}
}

import {
	type AccountMemoriesLoaderData,
	loadAccountMemoriesData,
	loadAccountMemoriesExport,
	readAccountMemoriesIncludeDeleted,
} from '#app/account-memories-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { memoryLegacyWriteFrozenMessage } from '#mcp/memory/memory-owner.ts'
import { deleteMemory } from '#mcp/memory/service.ts'
import { buildMemoriesExportFilename } from '#universal/memory-export.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { isPersonalOrg } from '#worker/orgs/is-personal-org.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

/**
 * GET /account/memories-export.json for the org whose Memories page sent it
 * (Referer), else the signed-in user's signup org.
 * Follows the page Include deleted toggle: active and archived by default;
 * deleted rows only when that control is on.
 */
export function createAccountMemoriesExportHandler(env: Env) {
	return async ({ request }: { request: Request }) => {
		const user = await readAuthenticatedAppUser(request, env)
		if (!user) {
			return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
		}
		if (request.method !== 'GET') {
			return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
		}

		const includeDeleted = readAccountMemoriesIncludeDeleted(request.url)
		const payload = await loadAccountMemoriesExport({
			env,
			user,
			includeDeleted,
		})
		const filename = buildMemoriesExportFilename()
		return new Response(JSON.stringify(payload, null, 2), {
			status: 200,
			headers: {
				'Cache-Control': 'no-store',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'Content-Type': 'application/json; charset=utf-8',
			},
		})
	}
}

async function handleDeleteAction(input: {
	env: Env
	user: AuthenticatedUser
	memoryId: string
	force: boolean
	refresh: {
		query: string
		includeDeleted: boolean
		selectedMemoryId: string | null
	}
}) {
	const memoryId = input.memoryId.trim()
	if (!memoryId) {
		return operationResult({ ok: false, error: 'Memory id is required.' }, 400)
	}
	const force = input.force
	const deleted = await deleteMemory({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		memoryId,
		force,
	})
	if (!deleted) {
		return operationResult({ ok: false, error: 'Memory not found.' }, 404)
	}
	const payload: AccountMemoriesLoaderData = await loadAccountMemoriesData({
		env: input.env,
		user: input.user,
		...input.refresh,
	})
	return operationResult(payload)
}

export async function deleteAccountMemoryRecord({
	env,
	user,
	refresh,
	memoryId,
	force,
}: {
	env: Env
	user: AuthenticatedUser
	refresh: {
		query: string
		includeDeleted: boolean
		selectedMemoryId: string | null
	}
	memoryId: string
	force: boolean
}) {
	try {
		const ownerId = ownerIdFromCaller({
			request: user.request,
			user: user.mcpUser,
		})
		if (!(await isPersonalOrg(env.APP_DB, ownerId))) {
			return operationResult(
				{ ok: false, error: memoryLegacyWriteFrozenMessage },
				400,
			)
		}
		return await handleDeleteAction({
			env,
			user,
			memoryId,
			force,
			refresh,
		})
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error ? error.message : 'Unable to update memories.',
			},
			400,
		)
	}
}

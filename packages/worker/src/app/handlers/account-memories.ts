import {
	type AccountMemoriesLoaderData,
	loadAccountMemoriesData,
	loadAccountMemoriesExport,
	readAccountMemoriesIncludeDeleted,
} from '#app/account-memories-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import { memoryLegacyWriteFrozenMessage } from '#mcp/memory/memory-owner.ts'
import { deleteMemory } from '#mcp/memory/service.ts'
import { buildMemoriesExportFilename } from '#universal/memory-export.ts'
import { type routes } from '#universal/routes.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { isPersonalOrg } from '#worker/orgs/is-personal-org.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { type Action } from 'remix/router'

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
	return {
		middleware: [],
		async handler({ request }) {
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
		},
	} satisfies Action<typeof routes.accountMemoriesExport>
}

async function handleDeleteAction(input: {
	env: Env
	user: AuthenticatedUser
	body: object
	request: Request
}) {
	const memoryId = readTrimmedStringOrEmpty(input.body, 'memoryId')
	if (!memoryId) {
		return operationResult({ ok: false, error: 'Memory id is required.' }, 400)
	}
	const force = readBoolean(input.body, 'force', false)
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
		request: input.request,
		user: input.user,
	})
	return operationResult(payload)
}

export function readPathMemoryId(params: unknown) {
	if (
		typeof params === 'object' &&
		params !== null &&
		'memoryId' in params &&
		typeof params.memoryId === 'string'
	) {
		return params.memoryId
	}
	return undefined
}

function readBoolean(body: object, key: string, defaultValue: boolean) {
	const value = (body as Record<string, unknown>)[key]
	return typeof value === 'boolean' ? value : defaultValue
}

export async function mutateAccountMemories({
	env,
	user,
	request,
	body,
}: {
	env: Env
	user: AuthenticatedUser
	request: Request
	body: object
}) {
	const action = readTrimmedStringOrEmpty(body, 'action')
	try {
		if (action === 'delete') {
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
				body,
				request,
			})
		}
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

	return operationResult({ ok: false, error: 'Invalid action.' }, 400)
}

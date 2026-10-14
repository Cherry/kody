import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import {
	bindSecretProvider,
	grantSecretProviderToPackage,
	revokeSecretProviderGrant,
	unbindSecretProvider,
} from '#mcp/secrets/secret-providers/service.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

async function handleBind(input: {
	env: Env
	user: AuthenticatedUser
	body: object
	requestUrl: string
}) {
	const bound = await bindSecretProvider({
		env: input.env,
		baseUrl: new URL(input.requestUrl).origin,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		providerId: readTrimmedStringOrEmpty(input.body, 'provider'),
		packageId: readTrimmedStringOrEmpty(input.body, 'packageId'),
		doorSecretName: readTrimmedStringOrEmpty(input.body, 'doorSecretName'),
		config: readConfig(input.body),
	})
	return operationResult({ ok: true, bound })
}

async function handleUnbind(input: {
	env: Env
	user: AuthenticatedUser
	body: object
}) {
	await unbindSecretProvider({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		providerId: readTrimmedStringOrEmpty(input.body, 'provider'),
	})
	return operationResult({ ok: true })
}

async function handleGrant(input: {
	env: Env
	user: AuthenticatedUser
	body: object
}) {
	const granted = await grantSecretProviderToPackage({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		providerId: readTrimmedStringOrEmpty(input.body, 'provider'),
		ref: readTrimmedStringOrEmpty(input.body, 'ref'),
		packageId: readTrimmedStringOrEmpty(input.body, 'packageId'),
	})
	return operationResult({ ok: true, granted })
}

async function handleRevoke(input: {
	env: Env
	user: AuthenticatedUser
	body: object
}) {
	await revokeSecretProviderGrant({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		providerId: readTrimmedStringOrEmpty(input.body, 'provider'),
		ref: readTrimmedStringOrEmpty(input.body, 'ref'),
		packageId: readTrimmedStringOrEmpty(input.body, 'packageId'),
	})
	return operationResult({ ok: true })
}

function readConfig(body: object) {
	const value = (body as Record<string, unknown>).config
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
	const config: Record<string, string> = {}
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === 'string') config[key] = entry
	}
	return config
}

export async function mutateAccountSecretProviders({
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
		if (action === 'bind') {
			return await handleBind({ env, user, body, requestUrl: request.url })
		}
		if (action === 'unbind') {
			return await handleUnbind({ env, user, body })
		}
		if (action === 'grant') {
			return await handleGrant({ env, user, body })
		}
		if (action === 'revoke') {
			return await handleRevoke({ env, user, body })
		}
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Unable to update secret providers.',
			},
			400,
		)
	}
	return operationResult({ ok: false, error: 'Invalid action.' }, 400)
}

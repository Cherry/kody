import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { toOauthAppPublic } from '#mcp/capabilities/integrations/oauth-app-shared.ts'
import { persistUserOauthAppClientSecret } from '#worker/integrations/credentials.ts'
import {
	deleteIntegration,
	deleteOauthAppWithConnections,
	getOauthApp,
	grantIntegrationPackage,
	listJoinedIntegrations,
	rotateOauthAppClientCredentials,
	setIntegrationUsage,
} from '#worker/integrations/service.ts'
import { listSavedPackagesByUserId } from '#worker/package-registry/repo.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { z } from 'zod'

const rotateOauthAppCredentialsSchema = z
	.object({
		action: z.literal('rotate_oauth_app_credentials'),
		appSlug: z.string().min(1),
		clientId: z.string().min(1).optional(),
		clientSecret: z.string().min(1).optional(),
		confirm: z.literal(true),
	})
	.strict()
	.refine((value) => Boolean(value.clientId || value.clientSecret), {
		message: 'Provide a new client id and/or client secret.',
	})

const disconnectConnectionSchema = z
	.object({
		action: z.literal('disconnect_connection'),
		name: z.string().min(1),
	})
	.strict()

const deleteOauthAppSchema = z
	.object({
		action: z.literal('delete_oauth_app'),
		appSlug: z.string().min(1),
	})
	.strict()

const setUsageSchema = z
	.object({
		action: z.literal('set_usage'),
		name: z.string().min(1),
		usageMode: z.enum(['any', 'packages']),
		allowedPackageIds: z.array(z.string()).optional(),
	})
	.strict()

const approvePackageSchema = z
	.object({
		action: z.literal('approve_package'),
		name: z.string().min(1),
		packageId: z.string().min(1),
	})
	.strict()

const accountIntegrationsActionSchema = z
	.object({
		action: z.enum([
			'rotate_oauth_app_credentials',
			'disconnect_connection',
			'delete_oauth_app',
			'set_usage',
			'approve_package',
		]),
	})
	.passthrough()

async function handleSetUsage(input: {
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: z.infer<typeof setUsageSchema>
}) {
	const allowedPackageIds =
		input.body.usageMode === 'packages'
			? (input.body.allowedPackageIds ?? [])
			: []
	const updated = await setIntegrationUsage({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		name: input.body.name,
		usageMode: input.body.usageMode,
		allowedPackageIds,
	})
	if (!updated) {
		return operationResult({ ok: false, error: 'Connection not found.' }, 404)
	}
	return operationResult({
		ok: true,
		usageMode: updated.usageMode,
		allowedPackageIds: updated.allowedPackageIds,
	})
}

async function handleApprovePackage(input: {
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: z.infer<typeof approvePackageSchema>
}) {
	const userId = ownerIdFromCaller({
		request: input.user.request,
		user: input.user.mcpUser,
	})
	const savedPackage = (
		await listSavedPackagesByUserId(input.env.APP_DB, {
			userId,
		})
	).find((entry) => entry.id === input.body.packageId)
	if (!savedPackage) {
		return operationResult(
			{ ok: false, error: 'That package is not on this account.' },
			400,
		)
	}
	const updated = await grantIntegrationPackage({
		env: input.env,
		userId,
		name: input.body.name,
		packageId: input.body.packageId,
	})
	if (!updated) {
		return operationResult({ ok: false, error: 'Connection not found.' }, 404)
	}
	return operationResult({
		ok: true,
		alreadyGranted:
			updated.usageMode === 'any' ||
			updated.allowedPackageIds.includes(input.body.packageId),
		usageMode: updated.usageMode,
		allowedPackageIds: updated.allowedPackageIds,
	})
}

async function handleDisconnectConnection(input: {
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	name: string
}) {
	const deleted = await deleteIntegration({
		env: input.env,
		userId: ownerIdFromCaller({
			request: input.user.request,
			user: input.user.mcpUser,
		}),
		name: input.name,
	})
	if (!deleted) {
		return operationResult({ ok: false, error: 'Connection not found.' }, 404)
	}
	return operationResult({ ok: true, deleted: true })
}

async function handleDeleteOauthApp(input: {
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	appSlug: string
}) {
	const userId = ownerIdFromCaller({
		request: input.user.request,
		user: input.user.mcpUser,
	})
	const existing = await getOauthApp({
		env: input.env,
		userId,
		slug: input.appSlug,
	})
	if (!existing) {
		return operationResult({ ok: false, error: 'OAuth app not found.' }, 404)
	}
	const result = await deleteOauthAppWithConnections({
		env: input.env,
		userId,
		slug: existing.slug,
	})
	if (!result.deleted) {
		return operationResult({ ok: false, error: 'OAuth app not found.' }, 404)
	}
	return operationResult({
		ok: true,
		deleted: true,
		connectionNames: result.connectionNames,
	})
}

async function handleRotateOauthAppCredentials(input: {
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: z.infer<typeof rotateOauthAppCredentialsSchema>
}) {
	const userId = ownerIdFromCaller({
		request: input.user.request,
		user: input.user.mcpUser,
	})
	const existing = await getOauthApp({
		env: input.env,
		userId,
		slug: input.body.appSlug,
	})
	if (!existing) {
		return operationResult({ ok: false, error: 'OAuth app not found.' }, 404)
	}

	const nextClientId = input.body.clientId?.trim() || existing.clientId

	try {
		if (input.body.clientSecret) {
			await persistUserOauthAppClientSecret({
				env: input.env,
				userId,
				slug: existing.slug,
				value: input.body.clientSecret,
			})
		}

		const rotated = await rotateOauthAppClientCredentials({
			env: input.env,
			userId,
			slug: existing.slug,
			clientId: nextClientId,
		})
		const joined = await listJoinedIntegrations({
			env: input.env,
			userId,
		})
		const connections = joined
			.filter((entry) => entry.app.slug === rotated.slug)
			.map(({ connection }) => ({
				name: connection.name,
				accountLabel: connection.accountLabel,
			}))
		return operationResult({
			ok: true,
			app: toOauthAppPublic(
				{ ...rotated, connectionCount: connections.length },
				connections,
			),
		})
	} catch (error) {
		return operationResult(
			{
				ok: false,
				error:
					error instanceof Error
						? error.message
						: 'Unable to rotate OAuth app credentials.',
			},
			400,
		)
	}
}

export async function mutateAccountIntegrations({
	env,
	user,
	body,
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: Record<string, unknown>
}) {
	const actionParsed = accountIntegrationsActionSchema.safeParse(body)
	if (!actionParsed.success) {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}

	switch (actionParsed.data.action) {
		case 'rotate_oauth_app_credentials': {
			const parsed = rotateOauthAppCredentialsSchema.safeParse(body)
			if (!parsed.success) {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}
			return handleRotateOauthAppCredentials({
				env,
				user,
				body: parsed.data,
			})
		}
		case 'disconnect_connection': {
			const parsed = disconnectConnectionSchema.safeParse(body)
			if (!parsed.success) {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}
			return handleDisconnectConnection({
				env,
				user,
				name: parsed.data.name,
			})
		}
		case 'delete_oauth_app': {
			const parsed = deleteOauthAppSchema.safeParse(body)
			if (!parsed.success) {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}
			return handleDeleteOauthApp({
				env,
				user,
				appSlug: parsed.data.appSlug,
			})
		}
		case 'set_usage': {
			const parsed = setUsageSchema.safeParse(body)
			if (!parsed.success) {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}
			return handleSetUsage({
				env,
				user,
				body: parsed.data,
			})
		}
		case 'approve_package': {
			const parsed = approvePackageSchema.safeParse(body)
			if (!parsed.success) {
				return operationResult(
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}
			return handleApprovePackage({
				env,
				user,
				body: parsed.data,
			})
		}
		default: {
			const _exhaustive: never = actionParsed.data.action
			return _exhaustive
		}
	}
}

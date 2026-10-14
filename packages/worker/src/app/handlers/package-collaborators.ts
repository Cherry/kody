import { z } from 'zod'
import type { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { isMcpCallerError } from '#mcp/caller-error.ts'
import {
	packageCollaboratorRemoveCapability,
	packageCollaboratorSetCapability,
} from '#mcp/capabilities/access/package-collaborators.ts'
import { type CapabilityContext } from '#mcp/capabilities/types.ts'
import { createMcpCallerContext } from '#mcp/context.ts'
import { getAppBaseUrl } from '#worker/app-base-url.ts'
import {
	AuthorizationError,
	checkPermission,
	computeEffectivePermissions,
	packageResource,
} from '#worker/authorization/authorize.ts'
import { operationResult } from '../operation-result.ts'
import { isPersonalOrg } from '#worker/orgs/is-personal-org.ts'
import { listPackageCollaborators } from '#worker/orgs/package-collaborators.ts'
import { loadOrgBindingForSlug, type OrgBinding } from '#worker/orgs/repo.ts'
import { resolveSavedPackage } from '#worker/package-invocations/module-artifacts.ts'
import {
	type PackageCollaboratorsView,
	packageCollaboratorPresets,
} from '#universal/package-collaborators.ts'

type AppUser = NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>

type CollaboratorsScope = {
	ctx: CapabilityContext
	org: OrgBinding['org']
	orgSlug: string
	savedPackage: { id: string; kodyId: string; name: string }
}

const presetSchema = z.enum(packageCollaboratorPresets)

const changeSchema = z.discriminatedUnion('intent', [
	z.strictObject({
		intent: z.literal('grant'),
		subjectType: z.enum(['user', 'team']),
		subjectId: z.string().trim().min(1),
		preset: presetSchema,
	}),
	z.strictObject({
		intent: z.literal('revoke'),
		grantId: z.string().trim().min(1),
	}),
])

/**
 * The package as the signed-in person sees it, bound to the `:username` org
 * (members and outside collaborators alike). Not found when they cannot read
 * the package there; forbidden when they can read it but not manage access.
 */
async function loadCollaboratorsScope(input: {
	env: Env
	request: Request
	user: AppUser
	username: string
	kodyId: string
}): Promise<
	| { kind: 'ok'; scope: CollaboratorsScope }
	| { kind: 'not_found' }
	| { kind: 'forbidden' }
> {
	const { env, user } = input
	const binding = await loadOrgBindingForSlug(
		env.APP_DB,
		user.mcpUser.userId,
		input.username,
	)
	if (!binding) return { kind: 'not_found' }
	const savedPackage = await resolveSavedPackage({
		db: env.APP_DB,
		userId: binding.org.id,
		packageIdOrKodyId: input.kodyId.trim(),
	})
	if (!savedPackage) return { kind: 'not_found' }
	const callerContext = createMcpCallerContext({
		baseUrl: getAppBaseUrl({ env, requestUrl: input.request.url }),
		source: { kind: 'session' },
		executionOrigin: 'interactive',
		user: user.mcpUser,
		orgBinding: binding,
	})
	if (!callerContext.request) return { kind: 'not_found' }
	const access = await computeEffectivePermissions({
		env,
		request: callerContext.request,
	})
	const resource = packageResource({
		id: savedPackage.id,
		userId: savedPackage.userId,
		label: savedPackage.kodyId,
	})
	if (!checkPermission(access, 'package:read', resource).allowed) {
		return { kind: 'not_found' }
	}
	if (!checkPermission(access, 'package:manage_access', resource).allowed) {
		return { kind: 'forbidden' }
	}
	return {
		kind: 'ok',
		scope: {
			ctx: { env, callerContext },
			org: binding.org,
			orgSlug: binding.org.slug ?? input.username,
			savedPackage: {
				id: savedPackage.id,
				kodyId: savedPackage.kodyId,
				name: savedPackage.name,
			},
		},
	}
}

async function buildCollaboratorsView(
	scope: CollaboratorsScope,
): Promise<PackageCollaboratorsView> {
	const db = scope.ctx.env.APP_DB
	const [listed, personal] = await Promise.all([
		listPackageCollaborators({
			db,
			orgId: scope.org.id,
			packageId: scope.savedPackage.id,
		}),
		isPersonalOrg(db, scope.org.id),
	])
	return {
		ok: true,
		package: scope.savedPackage,
		org: { slug: scope.orgSlug, personal },
		...listed,
	}
}

async function applyChange(
	scope: CollaboratorsScope,
	change: z.infer<typeof changeSchema>,
) {
	const { ctx, savedPackage } = scope
	const intent = change.intent
	switch (intent) {
		case 'grant':
			await packageCollaboratorSetCapability.handler(
				{
					package_id: savedPackage.id,
					...(change.subjectType === 'team'
						? { team_id: change.subjectId }
						: { user_id: change.subjectId }),
					preset: change.preset,
				},
				ctx,
			)
			return
		case 'revoke':
			await packageCollaboratorRemoveCapability.handler(
				{ package_id: savedPackage.id, grant_id: change.grantId },
				ctx,
			)
			return
		default: {
			const exhaustive: never = intent
			throw new Error(`Unknown collaborator change: ${String(exhaustive)}`)
		}
	}
}

type CollaboratorsInput = {
	env: Env
	request: Request
	user: AppUser
	username: string
	kodyId: string
}
async function authorizedScope(input: CollaboratorsInput) {
	const loaded = await loadCollaboratorsScope(input)
	if (loaded.kind === 'not_found')
		return {
			error: operationResult(
				{ ok: false as const, error: 'Package not found.' },
				404,
			),
		}
	if (loaded.kind === 'forbidden')
		return {
			error: operationResult(
				{
					ok: false as const,
					error:
						'You need Manage on this package to see and change who can use it.',
				},
				403,
			),
		}
	return { scope: loaded.scope }
}
export async function readPackageCollaborators(input: CollaboratorsInput) {
	const loaded = await authorizedScope(input)
	if (loaded.error) return loaded.error
	return operationResult(await buildCollaboratorsView(loaded.scope))
}
export async function mutatePackageCollaborators(
	input: CollaboratorsInput & { body: unknown },
) {
	const loaded = await authorizedScope(input)
	if (loaded.error) return loaded.error
	const parsed = changeSchema.safeParse(input.body)
	if (!parsed.success)
		return operationResult(
			{
				ok: false as const,
				error: `Invalid request body: ${parsed.error.issues[0]?.message ?? 'expected one change'}.`,
			},
			400,
		)
	try {
		await applyChange(loaded.scope, parsed.data)
	} catch (error) {
		if (error instanceof AuthorizationError)
			return operationResult({ ok: false as const, error: error.message }, 403)
		if (isMcpCallerError(error) && error instanceof Error)
			return operationResult({ ok: false as const, error: error.message }, 400)
		throw error
	}
	const view = await buildCollaboratorsView(loaded.scope)
	return operationResult(view)
}

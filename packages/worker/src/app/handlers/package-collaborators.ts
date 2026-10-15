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
	type PackageCollaboratorPreset,
} from '#universal/package-collaborators.ts'

type AppUser = NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>

export type CollaboratorsScope = {
	ctx: CapabilityContext
	org: OrgBinding['org']
	orgSlug: string
	savedPackage: { id: string; kodyId: string; name: string }
}

/**
 * The package as the signed-in person sees it, bound to the `:username` org
 * (members and outside collaborators alike). Not found when they cannot read
 * the package there; forbidden when they can read it but not manage access.
 */
export async function loadCollaboratorsScope(input: {
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
export function grantPackageCollaborator(
	input: CollaboratorsInput & {
		subjectType: 'user' | 'team'
		subjectId: string
		preset: PackageCollaboratorPreset
	},
) {
	return changeCollaborator(input, async ({ ctx, savedPackage }) => {
		await packageCollaboratorSetCapability.handler(
			{
				package_id: savedPackage.id,
				...(input.subjectType === 'team'
					? { team_id: input.subjectId }
					: { user_id: input.subjectId }),
				preset: input.preset,
			},
			ctx,
		)
	})
}
export function revokePackageCollaborator(
	input: CollaboratorsInput & { grantId: string },
) {
	return changeCollaborator(input, async ({ ctx, savedPackage }) => {
		await packageCollaboratorRemoveCapability.handler(
			{ package_id: savedPackage.id, grant_id: input.grantId },
			ctx,
		)
	})
}
async function changeCollaborator(
	input: CollaboratorsInput,
	apply: (scope: CollaboratorsScope) => Promise<void>,
) {
	const loaded = await authorizedScope(input)
	if (loaded.error) return loaded.error
	try {
		await apply(loaded.scope)
	} catch (error) {
		if (error instanceof AuthorizationError)
			return operationResult({ ok: false as const, error: error.message }, 403)
		if (isMcpCallerError(error) && error instanceof Error)
			return operationResult({ ok: false as const, error: error.message }, 400)
		throw error
	}
	return operationResult(await buildCollaboratorsView(loaded.scope))
}

import { operationResult } from '../operation-result.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import {
	orgHasPermission,
	resolveOrgManagementAccess,
	type ManagedOrg,
} from '#app/org-management-access.ts'
import { processUserAvatar } from '#worker/community/avatar.ts'
import {
	buildOrgAvatarUrl,
	deleteOrgAvatar,
	saveOrgAvatar,
} from '#worker/orgs/org-avatar.ts'
import { updateOrgProfile } from '#worker/orgs/org-profile.ts'
import { softDeleteOrg } from '#worker/orgs/soft-delete.ts'
import { type OrgSettingsLoaderData } from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import { packageAppCustomDomainsCnameTargetFromBaseUrl } from '#worker/package-app-custom-hostnames/cname-target.ts'
import { isPackageAppCustomDomainsEnabledForUser } from '#worker/package-app-custom-hostnames/feature-flag.ts'
import {
	addPackageAppCustomHostname,
	deletePackageAppCustomHostname,
	listPackageAppCustomHostnames,
	PackageAppCustomHostnameError,
	syncPackageAppCustomHostname,
} from '#worker/package-app-custom-hostnames/service.ts'

async function loadCustomDomainsView(
	env: Env,
	orgId: string,
	actingUserId: number,
): Promise<OrgSettingsLoaderData['customDomains']> {
	// Same gate as mutations/MCP: audience + per-user overrides. Global-only
	// would hide the panel for override users who can still add/sync.
	if (
		!(await isPackageAppCustomDomainsEnabledForUser(env.APP_DB, actingUserId))
	) {
		return null
	}
	try {
		const listed = await listPackageAppCustomHostnames({
			env,
			orgId,
			actingUserId,
		})
		return {
			dnsTarget: packageAppCustomDomainsCnameTargetFromBaseUrl(
				env.PACKAGE_APP_BASE_URL,
			),
			hostnames: listed.hostnames.map((row) => ({
				id: row.id,
				hostname: row.hostname,
				bindingKind: row.binding_kind,
				packageId: row.package_id,
				hostnameStatus: row.hostname_status,
				sslStatus: row.ssl_status,
				verifiedAt: row.verified_at,
				dnsMissingSince: row.dns_missing_since,
				ownershipVerification: row.verification.ownership_verification,
				sslValidationRecords: row.verification.ssl_validation_records,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		}
	} catch (error) {
		if (error instanceof PackageAppCustomHostnameError) {
			// Flag flipped mid-request or env not ready — hide the panel.
			return null
		}
		throw error
	}
}

export async function loadOrgSettingsData(input: {
	env: Env
	user: Parameters<typeof orgHasPermission>[1]
	org: ManagedOrg
}): Promise<OrgSettingsLoaderData> {
	// Signup orgs keep identity and deletion on Account pages even when
	// another owner somehow holds org:write on that org.
	const teamOrg = !input.org.personal
	const canManage =
		teamOrg && (await orgHasPermission(input.env, input.user, 'org:write'))
	return {
		ok: true,
		org: input.org,
		canManage,
		canDelete:
			teamOrg && (await orgHasPermission(input.env, input.user, 'org:delete')),
		customDomains: canManage
			? await loadCustomDomainsView(input.env, input.org.id, input.user.userId)
			: null,
	}
}

async function readFileBytes(file: File): Promise<Uint8Array> {
	return new Uint8Array(await file.arrayBuffer())
}

export async function mutateOrgSettingsPost(input: {
	env: Env
	request: Request
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	orgSlug?: string
	body: unknown
}) {
	const { env, request, user } = input
	const access = await resolveOrgManagementAccess({
		request,
		env,
		user,
		orgSlug: input.orgSlug,
		permission: 'org:write',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) {
		return operationResult(
			{
				ok: false,
				error: 'Your name, photo, and handle live on your account profile.',
			},
			400,
		)
	}
	const body = input.body as {
		displayName?: unknown
		slug?: unknown
	} | null
	if (!body || typeof body !== 'object') {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}
	const updated = await updateOrgProfile(env.APP_DB, {
		orgId: access.org.id,
		displayName:
			typeof body.displayName === 'string' ? body.displayName : undefined,
		slug: typeof body.slug === 'string' ? body.slug : undefined,
	})
	if (!updated.ok) {
		return operationResult({ ok: false, error: updated.error }, 400)
	}
	const next = {
		...access.org,
		slug: updated.slug,
		displayName: updated.displayName,
	}
	return operationResult(await loadOrgSettingsData({ env, user, org: next }))
}

export async function mutateOrgSettingsAvatarPost(input: {
	env: Env
	request: Request
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	orgSlug?: string
	body: unknown
}) {
	const { env, request, user } = input
	const access = await resolveOrgManagementAccess({
		request,
		env,
		user,
		orgSlug: input.orgSlug,
		permission: 'org:write',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) {
		return operationResult(
			{
				ok: false,
				error: 'Your photo lives on your account profile.',
			},
			400,
		)
	}

	if (!(input.body instanceof FormData)) {
		const body = input.body
		if (
			!body ||
			typeof body !== 'object' ||
			(body as Record<string, unknown>).remove !== true
		) {
			return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
		}
		await deleteOrgAvatar({ env, orgId: access.org.id })
		return operationResult(
			await loadOrgSettingsData({
				env,
				user,
				org: { ...access.org, avatarUrl: null },
			}),
		)
	}

	let formData: FormData
	try {
		if (!(input.body instanceof FormData)) throw new Error('Expected form data')
		formData = input.body
	} catch {
		return operationResult(
			{
				ok: false,
				error: 'Expected multipart form data with an avatar file.',
			},
			400,
		)
	}
	const avatar = formData.get('avatar')
	if (!(avatar instanceof File) || avatar.size === 0) {
		return operationResult(
			{ ok: false, error: 'Avatar file is required.' },
			400,
		)
	}
	let sourceBytes: Uint8Array
	try {
		sourceBytes = await readFileBytes(avatar)
	} catch (error) {
		console.error('org-avatar-read-failed', error)
		return operationResult({ ok: false, error: 'Unable to read avatar.' }, 500)
	}
	let processed: ReturnType<typeof processUserAvatar>
	try {
		processed = processUserAvatar({
			contentType: avatar.type || 'application/octet-stream',
			sourceBytes,
		})
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unable to process avatar.'
		return operationResult({ ok: false, error: message }, 400)
	}
	try {
		const avatarKey = await saveOrgAvatar({
			env,
			orgId: access.org.id,
			bytes: processed.bytes,
			contentType: processed.contentType,
		})
		return operationResult(
			await loadOrgSettingsData({
				env,
				user,
				org: {
					...access.org,
					avatarUrl: buildOrgAvatarUrl({
						slug: access.org.slug,
						avatarKey,
					}),
				},
			}),
		)
	} catch (error) {
		console.error('org-avatar-save-failed', error)
		return operationResult({ ok: false, error: 'Unable to save avatar.' }, 500)
	}
}

export async function mutateOrgSettingsDeletePost(input: {
	env: Env
	request: Request
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	orgSlug?: string
	body: unknown
}) {
	const { env, request, user } = input
	const access = await resolveOrgManagementAccess({
		request,
		env,
		user,
		orgSlug: input.orgSlug,
		permission: 'org:delete',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) {
		return operationResult(
			{
				ok: false,
				error:
					'Your personal organization is your account. Delete it from Account → Data & deletion.',
			},
			400,
		)
	}
	const body = input.body as {
		confirmation?: unknown
	} | null
	const confirmation =
		typeof body?.confirmation === 'string' ? body.confirmation.trim() : ''
	if (confirmation !== access.org.slug && confirmation !== 'DELETE') {
		return operationResult(
			{
				ok: false,
				error: `Type ${access.org.slug} or DELETE to confirm.`,
			},
			400,
		)
	}
	await softDeleteOrg({
		env,
		orgId: access.org.id,
		actorUserId: user.mcpUser.userId,
	})
	return operationResult({
		ok: true,
		redirectTo: routes.accountOrganizations.href(),
	})
}

export async function mutateOrgSettingsCustomHostnamesPost(input: {
	env: Env
	request: Request
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	orgSlug?: string
	body: unknown
}) {
	const { env, request, user } = input
	const access = await resolveOrgManagementAccess({
		request,
		env,
		user,
		orgSlug: input.orgSlug,
		permission: 'org:write',
	})
	if (!access.ok) {
		return operationResult({ ok: false, error: access.error }, access.status)
	}
	if (access.org.personal) {
		return operationResult(
			{
				ok: false,
				error: 'Custom domains are only available on team organizations.',
			},
			400,
		)
	}
	if (
		!(await isPackageAppCustomDomainsEnabledForUser(env.APP_DB, user.userId))
	) {
		return operationResult(
			{
				ok: false,
				error: 'Package-app custom domains are not enabled for this user.',
			},
			404,
		)
	}
	const body = input.body as {
		action?: unknown
		hostname?: unknown
		id?: unknown
		binding_kind?: unknown
		package_id?: unknown
		ssl_method?: unknown
	} | null
	if (!body || typeof body !== 'object') {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}
	const action = typeof body.action === 'string' ? body.action.trim() : ''
	try {
		switch (action) {
			case 'add': {
				const hostname = typeof body.hostname === 'string' ? body.hostname : ''
				const bindingKind = body.binding_kind
				if (bindingKind !== 'app' && bindingKind !== 'org') {
					return operationResult(
						{ ok: false, error: 'binding_kind must be app or org.' },
						400,
					)
				}
				const sslMethod =
					body.ssl_method === 'txt' || body.ssl_method === 'http'
						? body.ssl_method
						: undefined
				await addPackageAppCustomHostname({
					env,
					orgId: access.org.id,
					actingUserId: user.userId,
					createdByUserId: user.mcpUser.userId,
					bindingKind,
					hostname,
					packageId:
						typeof body.package_id === 'string' ? body.package_id : undefined,
					sslMethod,
				})
				break
			}
			case 'sync': {
				await syncPackageAppCustomHostname({
					env,
					orgId: access.org.id,
					actingUserId: user.userId,
					hostname:
						typeof body.hostname === 'string' ? body.hostname : undefined,
					id: typeof body.id === 'string' ? body.id : undefined,
				})
				break
			}
			case 'delete': {
				await deletePackageAppCustomHostname({
					env,
					orgId: access.org.id,
					actingUserId: user.userId,
					hostname:
						typeof body.hostname === 'string' ? body.hostname : undefined,
					id: typeof body.id === 'string' ? body.id : undefined,
				})
				break
			}
			default:
				return operationResult(
					{ ok: false, error: 'action must be add, sync, or delete.' },
					400,
				)
		}
	} catch (error) {
		if (error instanceof PackageAppCustomHostnameError) {
			return operationResult({ ok: false, error: error.message }, 400)
		}
		throw error
	}
	return operationResult(
		await loadOrgSettingsData({ env, user, org: access.org }),
	)
}

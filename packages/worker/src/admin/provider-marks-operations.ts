import { base64ToBytes } from '@kody-internal/shared/base64.ts'
import { loadAdminProviderMarksData } from '#app/admin-provider-marks-data.ts'
import { requireUserWithRole } from '#app/permissions-server.ts'
import { readNonEmptyTrimmedString as readString } from '#app/request-body.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import {
	deletePlatformProviderMark,
	deletePlatformProviderMarkLogoAsset,
	getPlatformProviderMarkBySlug,
	PlatformProviderMarkValidationError,
	setPlatformProviderMarkLogo,
	upsertPlatformProviderMark,
} from '#worker/integrations/provider-marks.ts'
import { adminOperationResult } from './operation-result.ts'

export async function mutateAdminProviderMarks({
	env,
	request,
	url,
	body,
}: {
	env: Env
	request: Request
	url: URL
	body: Record<string, unknown>
}) {
	const actor = await requireUserWithRole(request, env, 'admin')
	if (!body || typeof body !== 'object') {
		return adminOperationResult(
			{ ok: false, error: 'Invalid request body.' },
			400,
		)
	}

	const action = readString(body, 'action')
	if (action === 'save') {
		return await handleSaveAction({ env, request, url, actor, body })
	}
	if (action === 'delete') {
		return await handleDeleteAction({ env, request, url, actor, body })
	}
	return adminOperationResult({ ok: false, error: 'Invalid action.' }, 400)
}

type AdminActor = Awaited<ReturnType<typeof requireUserWithRole>>

async function handleSaveAction(input: {
	env: Env
	request: Request
	url: URL
	actor: AdminActor
	body: object
}) {
	const record = input.body as Record<string, unknown>
	const slug = readString(input.body, 'slug')
	if (!slug) {
		return adminOperationResult({ ok: false, error: 'Slug is required.' }, 400)
	}
	const label = readString(input.body, 'label')
	const aliases = Array.isArray(record.aliases)
		? record.aliases.filter(
				(value): value is string => typeof value === 'string',
			)
		: undefined
	let logoBytes: Uint8Array | null | undefined
	let logoEnv: Pick<Env, 'COMMUNITY_ASSETS' | 'IMAGES'> | undefined
	if (record.logoBase64 !== undefined) {
		const assets = input.env.COMMUNITY_ASSETS
		const images = input.env.IMAGES
		if (!assets || !images) {
			return adminOperationResult(
				{ ok: false, error: 'Logo storage is not configured.' },
				503,
			)
		}
		logoEnv = { COMMUNITY_ASSETS: assets, IMAGES: images }
		const logoBase64 = record.logoBase64
		if (typeof logoBase64 === 'string' && logoBase64.trim()) {
			try {
				logoBytes = base64ToBytes(logoBase64.trim())
			} catch {
				return adminOperationResult(
					{ ok: false, error: 'Logo file is not valid base64.' },
					400,
				)
			}
		} else {
			logoBytes = null
		}
	}
	try {
		let mark = await upsertPlatformProviderMark({
			db: input.env.APP_DB,
			slug,
			...(label ? { label } : {}),
			...(aliases ? { aliases } : {}),
		})
		if (logoBytes !== undefined && logoEnv) {
			mark = await setPlatformProviderMarkLogo({
				db: input.env.APP_DB,
				env: logoEnv,
				slug: mark.slug,
				sourceBytes: logoBytes,
			})
		}
		void logAuditEvent({
			db: auditDatabaseFromEnv(input.env),
			category: 'admin',
			action: 'platform_provider_mark_admin_save',
			result: 'success',
			email: input.actor.email,
			ip: getRequestIp(input.request) ?? undefined,
			path: input.url.pathname,
			reason: `platform_provider_mark=${mark.slug}`,
		})
		return adminOperationResult(await loadAdminProviderMarksData(input.env))
	} catch (error) {
		if (error instanceof PlatformProviderMarkValidationError) {
			return adminOperationResult({ ok: false, error: error.message }, 400)
		}
		throw error
	}
}

async function handleDeleteAction(input: {
	env: Env
	request: Request
	url: URL
	actor: AdminActor
	body: object
}) {
	const slug = readString(input.body, 'slug')
	if (!slug) {
		return adminOperationResult({ ok: false, error: 'Slug is required.' }, 400)
	}
	const existing = await getPlatformProviderMarkBySlug({
		db: input.env.APP_DB,
		slug,
	})
	if (existing?.logoKey && !input.env.COMMUNITY_ASSETS) {
		return adminOperationResult(
			{ ok: false, error: 'Logo storage is not configured.' },
			503,
		)
	}
	const deleted = await deletePlatformProviderMark({
		db: input.env.APP_DB,
		slug,
	})
	if (deleted && input.env.COMMUNITY_ASSETS) {
		await deletePlatformProviderMarkLogoAsset({
			env: { COMMUNITY_ASSETS: input.env.COMMUNITY_ASSETS },
			logoKey: existing?.logoKey ?? null,
		})
	}
	void logAuditEvent({
		db: auditDatabaseFromEnv(input.env),
		category: 'admin',
		action: 'platform_provider_mark_admin_delete',
		result: 'success',
		email: input.actor.email,
		ip: getRequestIp(input.request) ?? undefined,
		path: input.url.pathname,
		reason: `platform_provider_mark=${slug}`,
	})
	return adminOperationResult(await loadAdminProviderMarksData(input.env))
}

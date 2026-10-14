import { adminOperationResult } from './operation-result.ts'
import { z } from 'zod'
import { requireUserWithRole } from '#app/permissions-server.ts'
import { CommunityActionError } from '#worker/community/errors.ts'
import {
	banCommunityUser,
	resolveCommunityReport,
} from '#worker/community/service.ts'
import { getCommunityReportById } from '#worker/community/repo.ts'

const adminCommunityReportPostSchema = z.object({
	intent: z.enum([
		'dismiss',
		'delist',
		'delete',
		'ban_reporter',
		'ban_reportee',
	]),
	reportId: z.string().min(1),
	note: z.string().optional(),
})

export async function mutateAdminCommunityReports({
	env,
	request,
	body,
}: {
	env: Env
	request: Request
	url: URL
	body: Record<string, unknown>
}) {
	const actor = await requireUserWithRole(request, env, 'admin')
	const parsed = adminCommunityReportPostSchema.safeParse(body)
	if (!parsed.success) {
		return adminOperationResult(
			{
				ok: false,
				error: parsed.error.issues[0]?.message ?? 'Invalid request body.',
			},
			400,
		)
	}

	const report = await getCommunityReportById(env.APP_DB, parsed.data.reportId)
	if (!report) {
		return adminOperationResult({ ok: false, error: 'Report not found.' }, 404)
	}

	const note = parsed.data.note?.trim() || undefined
	const adminUserId = actor.mcpUser.userId

	switch (parsed.data.intent) {
		case 'dismiss':
		case 'delist':
		case 'delete': {
			try {
				await resolveCommunityReport({
					env,
					adminUserId,
					reportId: parsed.data.reportId,
					action: parsed.data.intent,
					resolutionNote: note,
				})
			} catch (error) {
				if (error instanceof CommunityActionError) {
					return adminOperationResult({ ok: false, error: error.message }, 400)
				}
				console.error('Community report resolution failed:', error)
				return adminOperationResult(
					{ ok: false, error: 'Unable to resolve report.' },
					500,
				)
			}
			break
		}
		case 'ban_reporter': {
			try {
				await banCommunityUser({
					env,
					adminUserId,
					userId: report.reporterUserId,
					reason:
						note ?? `Banned via community report moderation (${report.id}).`,
				})
			} catch (error) {
				if (error instanceof CommunityActionError) {
					return adminOperationResult({ ok: false, error: error.message }, 400)
				}
				console.error('Community ban failed:', error)
				return adminOperationResult(
					{ ok: false, error: 'Unable to ban user.' },
					500,
				)
			}
			break
		}
		case 'ban_reportee': {
			try {
				await banCommunityUser({
					env,
					adminUserId,
					userId: report.listingOwnerUserId,
					reason:
						note ?? `Banned via community report moderation (${report.id}).`,
				})
			} catch (error) {
				if (error instanceof CommunityActionError) {
					return adminOperationResult({ ok: false, error: error.message }, 400)
				}
				console.error('Community ban failed:', error)
				return adminOperationResult(
					{ ok: false, error: 'Unable to ban user.' },
					500,
				)
			}
			break
		}
		default: {
			const unreachable: never = parsed.data.intent
			throw new Error(`Unsupported intent: ${unreachable}`)
		}
	}

	return adminOperationResult({ ok: true })
}

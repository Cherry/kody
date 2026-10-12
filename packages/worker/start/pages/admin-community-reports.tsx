/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { type AdminCommunityReportsLoaderData } from '#universal/loader-data.ts'
import {
	cardCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getDangerPillCss,
	getGhostButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { formatTimestamp } from '../components/local-timestamp.tsx'
import { SiteLink } from '../components/site-link.tsx'
import {
	AccountManagementInlineLinkNav,
	AccountManagementMessage,
	AccountManagementShell,
	AdminPageHeader,
	IdValue,
	accountInputCss,
} from './account-management-components.tsx'
/**
 * `IdValue` is a flex row (value plus copy control), so the label beside it
 * needs a flex line of its own rather than the default text flow.
 */
const idLineCss = {
	...descriptionCss,
	display: 'flex',
	alignItems: 'center',
	flexWrap: 'wrap' as const,
	gap: spacing.xs,
}
type ReportIntent =
	| 'dismiss'
	| 'delist'
	| 'delete'
	| 'ban_reporter'
	| 'ban_reportee'
const adminCommunityReportsApiPath = '/admin/community-reports.json'
const statusOptions = [
	{ value: 'open', label: 'Open' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'dismissed', label: 'Dismissed' },
	{ value: 'all', label: 'All' },
] as const
function buildReportsHref(currentHref: string, status: string) {
	const url = new URL(currentHref, 'http://localhost')
	if (status === 'open') url.searchParams.delete('status')
	else url.searchParams.set('status', status)
	return `${url.pathname}${url.search}`
}
export function AdminCommunityReportsPage({
	payload,
	currentHref,
}: {
	payload: AdminCommunityReportsLoaderData
	currentHref: string
}) {
	const { reports, statusFilter } = payload
	const invalidatePages = usePageInvalidation(mutationResources)
	const lifetime = useRef<AbortController | null>(null)
	useEffect(() => {
		const controller = new AbortController()
		lifetime.current = controller
		return () => controller.abort()
	}, [])
	const [message, setMessage] = useState<string | null>(null)
	const [actionState, setActionState] = useState<'idle' | 'acting'>('idle')
	const [noteByReportId, setNoteByReportId] = useState(
		new Map<string, string>(),
	)
	const [pendingDoubleCheckKey, setPendingDoubleCheckKey] = useState<
		string | null
	>(null)
	function getDoubleCheckKey(reportId: string, intent: ReportIntent) {
		return `${reportId}:${intent}`
	}
	function isDoubleCheckActive(reportId: string, intent: ReportIntent) {
		return pendingDoubleCheckKey === getDoubleCheckKey(reportId, intent)
	}

	function getNote(reportId: string) {
		return noteByReportId.get(reportId) ?? ''
	}
	function setNote(reportId: string, value: string) {
		setNoteByReportId((previous) => new Map(previous).set(reportId, value))
	}
	async function submitReportAction(reportId: string, intent: ReportIntent) {
		if (actionState !== 'idle') return
		setActionState('acting')
		setMessage(null)
		try {
			const response = await fetch(adminCommunityReportsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				signal: lifetime.current?.signal,
				body: JSON.stringify({
					intent,
					reportId,
					note: getNote(reportId) || undefined,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<{
				ok: boolean
				error?: string
			}>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error ?? 'Unable to complete action.')
			}
			setActionState('idle')
			await invalidatePages()
		} catch (error) {
			setActionState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to complete action.',
			)
		}
	}
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })
	const isMutating = actionState !== 'idle'
	const pending = false
	const status: string = 'ready'
	return (
		<AccountManagementShell busy={pending}>
			<AdminPageHeader
				title="Community reports"
				description="Review open reports and moderate community listings."
				currentHref={currentHref}
			/>

			<AccountManagementInlineLinkNav
				label="Report status"
				items={statusOptions.map((option) => ({
					href: buildReportsHref(currentHref, option.value),
					label: option.label,
					active: statusFilter === option.value,
				}))}
			/>

			{status === 'loading' ? (
				<p css={{ color: colors.textMuted, margin: 0 }}>
					Loading community reports…
				</p>
			) : null}
			{message ? (
				<AccountManagementMessage tone={status === 'error' ? 'error' : 'info'}>
					{message}
				</AccountManagementMessage>
			) : null}

			<div css={{ display: 'grid', gap: spacing.lg }}>
				{status === 'ready' && reports.length === 0 ? (
					<p css={descriptionCss}>No reports in this view.</p>
				) : null}
				{status === 'ready'
					? reports.map((report) => (
							<article key={report.id} css={cardCss}>
								<h2
									css={{
										margin: 0,
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
									}}
								>
									<SiteLink
										href={`/community/${report.listingId}`}
										css={{
											color: colors.primaryText,
											textDecoration: 'none',
										}}
									>
										{report.listingName}
									</SiteLink>
								</h2>
								<p css={descriptionCss}>
									<strong>Status:</strong> {report.status}
								</p>
								<p css={idLineCss}>
									<strong>Reporter:</strong>
									<IdValue
										value={report.reporterUserId}
										label="reporter user id"
									/>
								</p>
								<p css={idLineCss}>
									<strong>Owner:</strong>
									<IdValue
										value={report.listingOwnerUserId}
										label="listing owner user id"
									/>
								</p>
								<p css={descriptionCss}>
									<strong>Created:</strong> {formatTimestamp(report.createdAt)}
								</p>
								<p css={descriptionCss}>{report.reason}</p>

								<label css={fieldCss}>
									<span css={fieldLabelCss}>Moderation note</span>
									<input
										data-field-ring
										value={getNote(report.id)}
										disabled={isMutating}
										placeholder="Optional note for dismiss, delist, delete, or ban"
										onInput={(event) => {
											setNote(
												report.id,
												(event.target as HTMLInputElement).value,
											)
										}}
										css={accountInputCss}
									/>
								</label>

								<div
									css={{
										display: 'flex',
										gap: spacing.sm,
										flexWrap: 'wrap',
									}}
								>
									<button
										disabled={isMutating}
										onClick={() =>
											void submitReportAction(report.id, 'dismiss')
										}
										css={secondaryButtonCss}
									>
										Dismiss
									</button>
									<button
										disabled={isMutating}
										{...{
											onBlur: () => {
												if (
													pendingDoubleCheckKey ===
													getDoubleCheckKey(report.id, 'delist')
												)
													setPendingDoubleCheckKey(null)
											},
											onClick: (event: MouseEvent<HTMLButtonElement>) => {
												if (
													pendingDoubleCheckKey !==
													getDoubleCheckKey(report.id, 'delist')
												) {
													event.preventDefault()
													setPendingDoubleCheckKey(
														getDoubleCheckKey(report.id, 'delist'),
													)
													return
												}
												setPendingDoubleCheckKey(null)
												;(() => {
													void submitReportAction(report.id, 'delist')
												})()
											},
										}}
										css={dangerButtonCss}
									>
										{isDoubleCheckActive(report.id, 'delist')
											? 'Confirm delist'
											: 'Delist'}
									</button>
									<button
										disabled={isMutating}
										{...{
											onBlur: () => {
												if (
													pendingDoubleCheckKey ===
													getDoubleCheckKey(report.id, 'delete')
												)
													setPendingDoubleCheckKey(null)
											},
											onClick: (event: MouseEvent<HTMLButtonElement>) => {
												if (
													pendingDoubleCheckKey !==
													getDoubleCheckKey(report.id, 'delete')
												) {
													event.preventDefault()
													setPendingDoubleCheckKey(
														getDoubleCheckKey(report.id, 'delete'),
													)
													return
												}
												setPendingDoubleCheckKey(null)
												;(() => {
													void submitReportAction(report.id, 'delete')
												})()
											},
										}}
										css={dangerButtonCss}
									>
										{isDoubleCheckActive(report.id, 'delete')
											? 'Confirm delete'
											: 'Delete'}
									</button>
									<button
										disabled={isMutating}
										{...{
											onBlur: () => {
												if (
													pendingDoubleCheckKey ===
													getDoubleCheckKey(report.id, 'ban_reporter')
												)
													setPendingDoubleCheckKey(null)
											},
											onClick: (event: MouseEvent<HTMLButtonElement>) => {
												if (
													pendingDoubleCheckKey !==
													getDoubleCheckKey(report.id, 'ban_reporter')
												) {
													event.preventDefault()
													setPendingDoubleCheckKey(
														getDoubleCheckKey(report.id, 'ban_reporter'),
													)
													return
												}
												setPendingDoubleCheckKey(null)
												;(() => {
													void submitReportAction(report.id, 'ban_reporter')
												})()
											},
										}}
										css={dangerButtonCss}
									>
										{isDoubleCheckActive(report.id, 'ban_reporter')
											? 'Confirm ban reporter'
											: 'Ban reporter'}
									</button>
									<button
										disabled={isMutating}
										{...{
											onBlur: () => {
												if (
													pendingDoubleCheckKey ===
													getDoubleCheckKey(report.id, 'ban_reportee')
												)
													setPendingDoubleCheckKey(null)
											},
											onClick: (event: MouseEvent<HTMLButtonElement>) => {
												if (
													pendingDoubleCheckKey !==
													getDoubleCheckKey(report.id, 'ban_reportee')
												) {
													event.preventDefault()
													setPendingDoubleCheckKey(
														getDoubleCheckKey(report.id, 'ban_reportee'),
													)
													return
												}
												setPendingDoubleCheckKey(null)
												;(() => {
													void submitReportAction(report.id, 'ban_reportee')
												})()
											},
										}}
										css={dangerButtonCss}
									>
										{isDoubleCheckActive(report.id, 'ban_reportee')
											? 'Confirm ban owner'
											: 'Ban owner'}
									</button>
								</div>
							</article>
						))
					: null}
			</div>
		</AccountManagementShell>
	)
}

const mutationResources = [
	'loadAdminCommunityReports',
	'loadCommunity',
	'loadPackage',
	'loadProfile',
] as const

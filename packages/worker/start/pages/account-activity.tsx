/** @jsxImportSource @emotion/react */
import { formatTimestamp } from '../components/local-timestamp.tsx'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { CopyTextButton } from '../components/copy-text-button.tsx'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { renderActivityRunDetail } from './account-activity-detail.tsx'
import {
	activityEmptyLabel,
	activityErrorReviewPrompt,
	activityRoute,
	buildActivityApiRequestUrl,
	buildActivitySearch,
	formatDurationMs,
	getDataLatchKey,
	readStatusFilter,
	readSurfaceFilter,
	readTriageFilter,
	readViewFilter,
	runAttributionSubtitle,
	runDisplayName,
	statusColor,
	statusLabel,
	statusFilterOptions,
	surfaceFilterOptions,
	surfaceLabel,
	triageFilterOptions,
	viewFilterOptions,
} from './account-activity-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import {
	RecordTable,
	RecordTableSelect,
	recordBodyCss,
	recordCellClamp,
	recordStampCss,
} from './record-table.tsx'
import { renderWorkflowNameCell } from './workflow-name-display.tsx'
import {
	defaultAccountActivityStatusFilter,
	defaultAccountActivityTriageFilter,
	type AccountActivityStatusFilter,
	type AccountActivitySurfaceFilter,
	type AccountActivityTriageFilter,
	type AccountActivityViewFilter,
} from '#universal/account-activity-filters.ts'
import {
	type AccountActivityLoaderData,
	type AccountActivityRunDetail,
	type AccountActivityRunListItem,
	type AccountActivitySummary,
} from '#universal/loader-data.ts'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import { getGhostButtonCss } from '#universal/styles/style-primitives.ts'

const clampedCellCss = recordCellClamp(30)

export function AccountActivityPage({
	payload,
	currentHref,
}: {
	payload: AccountActivityLoaderData
	currentHref: string
}) {
	const [runs, setRuns] = useState<Array<AccountActivityRunListItem>>(
		payload.runs,
	)
	const [selectedRun, setSelectedRun] =
		useState<AccountActivityRunDetail | null>(payload.selectedRun)
	const [summary, setSummary] = useState<AccountActivitySummary | null>(
		payload.summary,
	)
	const [nextCursor, setNextCursor] = useState<string | null>(
		payload.nextCursor,
	)
	const [retentionDays, setRetentionDays] = useState(payload.retentionDays)
	const [message, setMessage] = useState<string | null>(null)
	const [loadingMore, setLoadingMore] = useState(false)
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		void router.navigate({ to: href, replace: true, resetScroll: false })
	const pagination = useRef<AbortController | null>(null)
	const locationKey = getDataLatchKey(currentHref)
	useEffect(() => () => pagination.current?.abort(), [locationKey, payload])

	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function showMessage(nextMessage: string | null) {
		setMessage(nextMessage)
	}

	function applyPayload(
		payload: AccountActivityLoaderData,
		options?: { append?: boolean },
	) {
		if (options?.append) {
			const seen = new Set(runs.map((run) => run.id))
			setRuns([...runs, ...payload.runs.filter((run) => !seen.has(run.id))])
		} else {
			setRuns(payload.runs)
		}
		setSelectedRun(payload.selectedRun)
		setSummary(payload.summary)
		setNextCursor(payload.nextCursor)
		setRetentionDays(payload.retentionDays)
	}

	async function loadMoreRuns() {
		if (loadingMore || !nextCursor) return
		setLoadingMore(true)
		const request = new AbortController()
		pagination.current = request
		const href = getCurrentHref()
		try {
			const response = await fetch(
				buildActivityApiRequestUrl(href, nextCursor),
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal: request.signal,
				},
			)
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<AccountActivityLoaderData>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error('Unable to load more activity.')
			}
			if (request.signal.aborted) return
			applyPayload(payload, { append: true })
			setLoadingMore(false)
		} catch (error) {
			if (request.signal.aborted) return
			setLoadingMore(false)
			showMessage(
				error instanceof Error
					? error.message
					: 'Unable to load more activity.',
			)
		}
	}

	function updateFilters(input: {
		view?: AccountActivityViewFilter
		status?: AccountActivityStatusFilter
		surface?: AccountActivitySurfaceFilter
		triage?: AccountActivityTriageFilter
	}) {
		const href = getCurrentHref()
		const selection = activityRoute.getSelection(href)
		const currentView = readViewFilter(href)
		const view = input.view ?? currentView
		const viewChanged = input.view != null && input.view !== currentView
		const search = buildActivitySearch({
			view,
			status:
				input.status ??
				(viewChanged
					? defaultAccountActivityStatusFilter(view)
					: readStatusFilter(href)),
			surface: input.surface ?? readSurfaceFilter(href),
			triage:
				input.triage ??
				(viewChanged
					? defaultAccountActivityTriageFilter(view)
					: readTriageFilter(href)),
		})
		if (selection.selectedId) {
			navigate(activityRoute.buildDetailHref(selection.selectedId, search))
			return
		}
		replaceLocation(activityRoute.buildListHref(search))
	}

	const status = 'ready'
	const [lastPayload, setLastPayload] = useState(payload)
	if (lastPayload !== payload) {
		setLastPayload(payload)
		applyPayload(payload)
		setLoadingMore(false)
		showMessage(null)
	}

	const selection = activityRoute.getSelection(currentHref)
	const viewFilter = readViewFilter(currentHref)
	const statusFilter = readStatusFilter(currentHref)
	const surfaceFilter = readSurfaceFilter(currentHref)
	const triageFilter = readTriageFilter(currentHref)
	const filterSearch = buildActivitySearch({
		view: viewFilter,
		status: statusFilter,
		surface: surfaceFilter,
		triage: triageFilter,
	})
	const detail =
		selectedRun && selectedRun.id === selection.selectedId ? selectedRun : null
	const waitingForDetail = false
	const showRunNotFound =
		selection.selectedId != null &&
		!detail &&
		!waitingForDetail &&
		status === 'ready'
	const readySummary = status === 'ready' ? summary : null
	const emptyLabel = activityEmptyLabel({
		view: viewFilter,
		status: statusFilter,
		surface: surfaceFilter,
		triage: triageFilter,
		summaryTotal: readySummary?.total ?? 0,
	})

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Activity"
				description="Open failures first, plus a Recent runs week of jobs, executes, package apps, webhooks, and workflows — with the logs you need to diagnose them."
				currentHref={currentHref}
			/>
			<figure
				css={{
					display: 'grid',
					gap: spacing.sm,
					justifyItems: 'start',
					margin: 0,
					maxWidth: '46rem',
				}}
			>
				<blockquote
					css={{
						margin: 0,
						color: colors.textMuted,
						fontSize: typography.fontSize.sm,
						lineHeight: 1.5,
					}}
				>
					{activityErrorReviewPrompt}
				</blockquote>
				<CopyTextButton
					value={activityErrorReviewPrompt}
					idleLabel="Copy prompt"
					variant="ghost"
					size="sm"
				/>
			</figure>

			{message ? (
				<AccountManagementMessage tone="error">
					{message}
				</AccountManagementMessage>
			) : null}

			{readySummary ? (
				<>
					<div
						css={{
							display: 'grid',
							gap: spacing.md,
							gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
						}}
					>
						{[
							{ label: 'Runs (7 days)', value: String(readySummary.total) },
							{ label: 'Open errors', value: String(readySummary.errors) },
							{
								label: 'Ignored / resolved',
								value: String(readySummary.ignored + readySummary.resolved),
							},
							{ label: 'Running now', value: String(readySummary.running) },
						].map((item) => (
							<div
								key={item.label}
								css={{
									display: 'grid',
									gap: spacing.xs,
									padding: spacing.md,
									border: `1px solid ${colors.border}`,
									borderRadius: radius.md,
									backgroundColor: colors.surface,
								}}
							>
								<span
									css={{
										color: colors.textMuted,
										fontSize: typography.fontSize.sm,
									}}
								>
									{item.label}
								</span>
								<strong
									css={{
										fontSize: typography.fontSize.xl,
										fontWeight: typography.fontWeight.semibold,
										color:
											item.label === 'Open errors' && readySummary.errors > 0
												? colors.error
												: colors.text,
									}}
								>
									{item.value}
								</strong>
							</div>
						))}
					</div>

					<p
						css={{
							margin: 0,
							color: colors.textMuted,
							fontSize: typography.fontSize.sm,
						}}
					>
						Ad-hoc execute runs are kept on success and on failure, the same as
						jobs and webhooks. Run records are kept for about {retentionDays}{' '}
						days. Open errors is the default view. Recent runs lists the last 7
						days across successes, running work, and errors. Ignored and
						resolved errors stay hidden from Open errors until you change the
						triage filter.
					</p>

					{showRunNotFound ? (
						<AccountManagementMessage tone="error">
							This run does not exist for this account, or it has aged out of
							the retention window.
						</AccountManagementMessage>
					) : null}

					<RecordTable
						mode="expand"
						ariaLabel="Activity runs"
						selectedId={selection.selectedId}
						recordLoading={waitingForDetail}
						onNavigate={() => showMessage(null)}
						emptyLabel={emptyLabel}
						toolbar={
							<>
								<RecordTableSelect
									label="Activity view"
									value={viewFilter}
									onChange={(rawValue) => {
										const value = rawValue as AccountActivityViewFilter
										if (
											!viewFilterOptions.some(
												(option) => option.value === value,
											)
										) {
											return
										}
										updateFilters({ view: value })
									}}
								>
									{viewFilterOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</RecordTableSelect>
								<RecordTableSelect
									label="Status filter"
									value={statusFilter}
									onChange={(rawValue) => {
										const value = rawValue as AccountActivityStatusFilter
										if (
											!statusFilterOptions.some(
												(option) => option.value === value,
											)
										) {
											return
										}
										updateFilters({ status: value })
									}}
								>
									{statusFilterOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</RecordTableSelect>
								<RecordTableSelect
									label="Surface filter"
									value={surfaceFilter}
									onChange={(rawValue) => {
										const value = rawValue as AccountActivitySurfaceFilter
										if (
											!surfaceFilterOptions.some(
												(option) => option.value === value,
											)
										) {
											return
										}
										updateFilters({ surface: value })
									}}
								>
									{surfaceFilterOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</RecordTableSelect>
								<RecordTableSelect
									label="Triage filter"
									value={triageFilter}
									onChange={(rawValue) => {
										const value = rawValue as AccountActivityTriageFilter
										if (
											!triageFilterOptions.some(
												(option) => option.value === value,
											)
										) {
											return
										}
										updateFilters({ triage: value })
									}}
								>
									{triageFilterOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</RecordTableSelect>
							</>
						}
						columns={[
							{ key: 'name', label: 'Run', primary: true },
							{ key: 'surface', label: 'Surface', drop: 3 },
							{ key: 'status', label: 'Status' },
							{ key: 'error', label: 'Error', drop: 1 },
							{ key: 'started', label: 'Started', drop: 2 },
							{ key: 'duration', label: 'Duration', align: 'end' },
						]}
						rows={runs.map((item) => {
							const attribution = runAttributionSubtitle(item)
							return {
								id: item.id,
								href: activityRoute.buildDetailHref(item.id, filterSearch),
								cells: {
									name: (
										<span
											css={{
												display: 'grid',
												gap: '0.125rem',
												minWidth: 0,
											}}
										>
											{renderWorkflowNameCell({
												name: runDisplayName(item),
												idempotencyKey: item.idempotencyKey,
											})}
											{attribution ? (
												<span css={recordStampCss}>{attribution}</span>
											) : null}
										</span>
									),
									surface: surfaceLabel(item.surface),
									status: (
										<span css={{ color: statusColor(item.status) }}>
											{statusLabel(item.status)}
										</span>
									),
									error: item.errorMessage ? (
										<span css={[clampedCellCss, { color: colors.error }]}>
											{item.errorMessage}
										</span>
									) : null,
									started: (
										<span css={recordStampCss}>
											{formatTimestamp(item.startedAt)}
										</span>
									),
									duration: (
										<span css={recordStampCss}>
											{formatDurationMs(item.durationMs)}
										</span>
									),
								},
							}
						})}
						footer={
							nextCursor ? (
								<button
									type="button"
									disabled={loadingMore}
									onClick={() => void loadMoreRuns()}
									css={{ ...secondaryButtonCss, width: '100%' }}
								>
									{loadingMore ? 'Loading more…' : 'Load more'}
								</button>
							) : null
						}
						record={
							detail ? (
								renderActivityRunDetail(detail)
							) : waitingForDetail ? (
								<p
									css={{
										...recordBodyCss,
										margin: 0,
										color: colors.textMuted,
									}}
								>
									Loading run details…
								</p>
							) : null
						}
					/>
				</>
			) : null}
		</AccountManagementShell>
	)
}

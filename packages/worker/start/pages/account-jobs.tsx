/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { useRouter, useRouteContext } from '@tanstack/react-router'
import {
	useMutation,
	useQueryClient,
	useIsMutating,
} from '@tanstack/react-query'
import {
	pageResourceKey,
	snapshotPageResource,
	restorePageResource,
} from '../page-mutation-cache.ts'
import { needsJobDetailRefresh } from './account-jobs-query.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	filterAccountJobs,
	readJobsSearchFilter,
	readJobsViewFilter,
	type AccountJobsViewFilter,
} from '#client/routes/account-jobs-filter.ts'
import {
	renderAccountJobDetail,
	renderJobDetailPlaceholder,
} from './account-jobs-detail.tsx'
import {
	type AccountJobsActionPayload,
	accountJobsApiPath,
	emptyJobsMessage,
	jobsRoute,
	packageLabel,
	statusColor,
	statusLabel,
	viewFilterOptions,
} from './account-jobs-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	accountInputCss,
} from './account-management-components.tsx'
import {
	RecordChips,
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordCellClamp,
} from './record-table.tsx'
import {
	type AccountJobListItem,
	type AccountJobsLoaderData,
} from '#universal/loader-data.ts'
import { spacing } from '#universal/styles/tokens.ts'
import {
	cardCss,
	cardTitleCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getGhostButtonCss,
} from '#universal/styles/style-primitives.ts'

const clampedCellCss = recordCellClamp(28)

type MessageTone = 'info' | 'error'

export function AccountJobsPage({
	payload,
	currentHref,
}: {
	payload: AccountJobsLoaderData
	currentHref: string
}) {
	const { username, jobs, selectedJob, retention } = payload
	// Only edits belong to the component. Untouched fields follow Query updates.
	const [retentionEdits, setRetentionEdits] = useState<
		Partial<
			Record<
				| 'successOnceDays'
				| 'failedOrNeverRanOnceDays'
				| 'disabledRecurringDays',
				string
			>
		>
	>({})
	const retentionDraft = {
		successOnceDays:
			retentionEdits.successOnceDays ?? String(retention.successOnceDays),
		failedOrNeverRanOnceDays:
			retentionEdits.failedOrNeverRanOnceDays ??
			String(retention.failedOrNeverRanOnceDays),
		disabledRecurringDays:
			retentionEdits.disabledRecurringDays ??
			String(retention.disabledRecurringDays),
	}

	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<MessageTone>('info')
	const [deleteArmed, setDeleteArmed] = useState(false)
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		void router.navigate({ to: href, replace: true, resetScroll: false })

	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function buildHrefWithUpdatedFilters(next: {
		search?: string
		view?: AccountJobsViewFilter
	}) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		const search = next.search ?? nextUrl.searchParams.get('q')?.trim() ?? ''
		const view = next.view ?? readJobsViewFilter(nextUrl.href)
		if (search) nextUrl.searchParams.set('q', search)
		else nextUrl.searchParams.delete('q')
		if (view === 'active') nextUrl.searchParams.delete('view')
		else nextUrl.searchParams.set('view', view)
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function showMessage(nextMessage: string | null, tone: MessageTone = 'info') {
		setMessage(nextMessage)
		setMessageTone(tone)
	}

	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const isMutating = useIsMutating({ mutationKey: ['jobs', actorKey] }) > 0
	type JobsQueryData = { payload: AccountJobsLoaderData }
	const jobsMutation = useMutation({
		mutationKey: ['jobs', actorKey],
		mutationFn: async (input: {
			body: Record<string, unknown>
			failureMessage: string
		}) => {
			const response = await fetch(accountJobsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(input.body),
			})
			if (response.status === 401) window.location.assign('/login')
			const result = await readJson<
				AccountJobsActionPayload & { error?: string; ok?: boolean }
			>(response)
			if (!response.ok || !result?.ok)
				throw new Error(result?.error || input.failureMessage)
			return result
		},
		onMutate: async ({ body }) => {
			const snapshot = await snapshotPageResource<JobsQueryData>(
				queryClient,
				actorKey,
				'loadJobsPage',
				(data) => ({ ...data, payload: optimisticJobs(data.payload, body) }),
			)
			return { snapshot }
		},
		onError: async (_error, _input, context) => {
			restorePageResource(queryClient, context?.snapshot)
			void queryClient.invalidateQueries({
				queryKey: pageResourceKey(actorKey, 'loadJobsPage'),
			})
		},
		onSuccess: async (accepted, { body }) => {
			const queryKey = pageResourceKey(actorKey, 'loadJobsPage')
			queryClient.setQueriesData<JobsQueryData>(
				{ queryKey },
				(data) =>
					data && {
						...data,
						payload: {
							...data.payload,
							username: accepted.username,
							jobs: accepted.jobs,
							retention: accepted.retention,
							selectedJob:
								data.payload.selectedJob?.id === accepted.selectedJob?.id
									? accepted.selectedJob
									: data.payload.selectedJob &&
										  accepted.jobs.some(
												(job) => job.id === data.payload.selectedJob?.id,
										  )
										? {
												...data.payload.selectedJob,
												...accepted.jobs.find(
													(job) => job.id === data.payload.selectedJob?.id,
												),
											}
										: null,
						},
					},
			)
			// The response contains the full list and the submitted detail. Other
			// cached details only received list fields and still need revalidation.
			const acceptedSelection = body.selectedJobId ?? body.id ?? null
			void queryClient.invalidateQueries({
				queryKey,
				predicate: (query) =>
					needsJobDetailRefresh(query.queryKey[3], acceptedSelection),
			})
		},
	})

	async function postAction(input: {
		body: Record<string, unknown>
		successMessage: (payload: AccountJobsActionPayload) => string | null
		failureMessage: string
		afterSuccess?: (payload: AccountJobsActionPayload) => void
	}) {
		if (queryClient.isMutating({ mutationKey: ['jobs', actorKey] })) return
		setDeleteArmed(false)
		showMessage(null)
		jobsMutation.mutate(input, {
			onSuccess: (payload) => {
				if (input.body.action === 'update_retention') {
					setRetentionEdits((edits) =>
						Object.fromEntries(
							Object.entries(edits).filter(
								([field, value]) => value !== String(input.body[field]),
							),
						),
					)
				}
				showMessage(input.successMessage(payload))
				input.afterSuccess?.(payload)
			},
			onError: (error) => {
				showMessage(
					error instanceof Error ? error.message : input.failureMessage,
					'error',
				)
			},
		})
	}

	const status = 'ready'
	const selection = jobsRoute.getSelection(currentHref)
	const search = readJobsSearchFilter(currentHref)
	const view = readJobsViewFilter(currentHref)
	const filteredJobs = filterAccountJobs(jobs, {
		view,
		search,
	})
	const listEmptyMessage = emptyJobsMessage({
		totalCount: jobs.length,
		filteredCount: filteredJobs.length,
		view,
		search,
	})
	const detail =
		selectedJob && selectedJob.id === selection.selectedId ? selectedJob : null
	const waitingForDetail = false
	const showJobNotFound =
		selection.selectedId != null &&
		!detail &&
		!waitingForDetail &&
		status === 'ready'

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Jobs"
				description="Inspect scheduled package jobs, toggle kill switch or Preserve, and run jobs now. Completed one-off jobs are cleaned up automatically after your retention windows; longer retention uses more scheduled job slots and storage."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage
					tone={messageTone === 'error' ? 'error' : 'info'}
				>
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' ? (
				<section
					css={{
						...cardCss,
						marginBottom: spacing.lg,
						display: 'grid',
						gap: spacing.md,
					}}
				>
					<div css={{ display: 'grid', gap: spacing.xs }}>
						<h2 css={cardTitleCss}>Job retention</h2>
						<p css={descriptionCss}>
							Platform defaults clean up successful one-off jobs after{' '}
							{retention.defaults.successOnce} days, failed or never-ran
							one-offs after {retention.defaults.failedOrNeverRanOnce} days, and
							disabled recurring jobs after{' '}
							{retention.defaults.disabledRecurring} days. Longer windows keep
							more jobs counting toward scheduled job slots and storage bytes.
							Keep forever only with Preserve on a job — retention cannot be
							unbounded.
						</p>
					</div>
					<div
						css={{
							display: 'grid',
							gap: spacing.md,
							gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
						}}
					>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Successful one-off (days)</span>
							<input
								data-field-ring
								type="number"
								min={1}
								max={365}
								value={retentionDraft.successOnceDays}
								disabled={isMutating}
								onInput={(event) => {
									setRetentionEdits({
										...retentionEdits,
										successOnceDays: (event.currentTarget as HTMLInputElement)
											.value,
									})
								}}
								css={accountInputCss}
							/>
						</label>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Failed / never-ran one-off (days)</span>
							<input
								data-field-ring
								type="number"
								min={1}
								max={365}
								value={retentionDraft.failedOrNeverRanOnceDays}
								disabled={isMutating}
								onInput={(event) => {
									setRetentionEdits({
										...retentionEdits,
										failedOrNeverRanOnceDays: (
											event.currentTarget as HTMLInputElement
										).value,
									})
								}}
								css={accountInputCss}
							/>
						</label>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Disabled recurring (days)</span>
							<input
								data-field-ring
								type="number"
								min={1}
								max={365}
								value={retentionDraft.disabledRecurringDays}
								disabled={isMutating}
								onInput={(event) => {
									setRetentionEdits({
										...retentionEdits,
										disabledRecurringDays: (
											event.currentTarget as HTMLInputElement
										).value,
									})
								}}
								css={accountInputCss}
							/>
						</label>
					</div>
					<div>
						<button
							type="button"
							disabled={isMutating}
							onClick={() =>
								postAction({
									body: {
										action: 'update_retention',
										successOnceDays: Number(retentionDraft.successOnceDays),
										failedOrNeverRanOnceDays: Number(
											retentionDraft.failedOrNeverRanOnceDays,
										),
										disabledRecurringDays: Number(
											retentionDraft.disabledRecurringDays,
										),
										selectedJobId: selection.selectedId,
									},
									successMessage: () => 'Updated job retention preferences.',
									failureMessage: 'Unable to update job retention preferences.',
								})
							}
							css={secondaryButtonCss}
						>
							Save retention
						</button>
					</div>
				</section>
			) : null}

			{status === 'ready' ? (
				<RecordTable
					mode="expand"
					ariaLabel="Scheduled jobs"
					selectedId={selection.selectedId}
					recordLoading={waitingForDetail}
					onNavigate={() => {
						setDeleteArmed(false)
						showMessage(null)
					}}
					countLabel={`${filteredJobs.length} of ${jobs.length} shown`}
					emptyLabel={listEmptyMessage ?? 'No jobs match the current filters.'}
					toolbar={
						<>
							<RecordTableSearch
								label="Search jobs"
								placeholder="Search jobs"
								value={search}
								onInput={(value) => {
									replaceLocation(
										buildHrefWithUpdatedFilters({ search: value }),
									)
								}}
							/>
							<RecordTableSelect
								label="Jobs view filter"
								value={view}
								onChange={(value) => {
									if (
										value !== 'active' &&
										value !== 'history' &&
										value !== 'all'
									) {
										return
									}
									replaceLocation(buildHrefWithUpdatedFilters({ view: value }))
								}}
							>
								{viewFilterOptions.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</RecordTableSelect>
						</>
					}
					columns={[
						{ key: 'name', label: 'Job', primary: true },
						{ key: 'status', label: 'Status' },
						{ key: 'schedule', label: 'Schedule', drop: 1 },
						{ key: 'package', label: 'Package', drop: 2 },
						{ key: 'flags', label: 'Flags', drop: 3 },
						{ key: 'runs', label: 'Runs', align: 'end' },
					]}
					rows={filteredJobs.map((item) => ({
						id: item.id,
						// A save, toggle, or delete is in flight; the expanded
						// editor owns the selection until it settles.
						href: isMutating
							? undefined
							: jobsRoute.buildDetailHref(item.id, getCurrentSearch()),
						cells: {
							name: <span css={clampedCellCss}>{item.name}</span>,
							status: (
								<span css={{ color: statusColor(item) }}>
									{statusLabel(item)}
								</span>
							),
							schedule: (
								<span css={clampedCellCss}>{item.scheduleSummary}</span>
							),
							package: <span css={clampedCellCss}>{packageLabel(item)}</span>,
							flags: (
								<RecordChips
									items={[
										...(item.preserved ? ['Preserved'] : []),
										...(item.expired ? ['Expired'] : []),
									]}
									empty="—"
								/>
							),
							runs: String(item.runCount),
						},
					}))}
					record={
						detail
							? renderAccountJobDetail({
									username,
									detail,
									isMutating,
									retention,
									deleteArmed,
									onDeleteArm: () => setDeleteArmed(true),
									onDeleteReset: () => setDeleteArmed(false),
									postAction,
									navigateToList: () => {
										navigate(jobsRoute.buildListHref(getCurrentSearch()))
									},
								})
							: waitingForDetail
								? renderJobDetailPlaceholder(
										'Loading job',
										'Loading job details…',
									)
								: showJobNotFound
									? renderJobDetailPlaceholder(
											'Job not found',
											'This job does not exist for this account or is unavailable.',
										)
									: null
					}
				/>
			) : null}
		</AccountManagementShell>
	)
}

function optimisticJobs(
	data: AccountJobsLoaderData,
	body: Record<string, unknown>,
): AccountJobsLoaderData {
	if (body.action === 'update_retention') {
		const { successOnceDays, failedOrNeverRanOnceDays, disabledRecurringDays } =
			body
		if (
			[successOnceDays, failedOrNeverRanOnceDays, disabledRecurringDays].every(
				(value) =>
					typeof value === 'number' && Number.isFinite(value) && value > 0,
			) &&
			typeof successOnceDays === 'number' &&
			typeof failedOrNeverRanOnceDays === 'number' &&
			typeof disabledRecurringDays === 'number'
		) {
			return {
				...data,
				retention: {
					...data.retention,
					successOnceDays,
					failedOrNeverRanOnceDays,
					disabledRecurringDays,
				},
			}
		}
	}
	const update = <T extends AccountJobListItem>(job: T): T => {
		if (job.id !== body.id) return job
		if (body.action === 'set_preserved' && typeof body.preserved === 'boolean')
			return { ...job, preserved: body.preserved }
		if (body.action === 'set_enabled' && typeof body.enabled === 'boolean')
			return { ...job, enabled: body.enabled }
		if (
			body.action === 'set_kill_switch' &&
			typeof body.killSwitchEnabled === 'boolean'
		)
			return { ...job, killSwitchEnabled: body.killSwitchEnabled }
		return job
	}
	return {
		...data,
		jobs: data.jobs.map(update),
		selectedJob: data.selectedJob && update(data.selectedJob),
	}
}

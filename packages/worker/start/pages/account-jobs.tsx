/** @jsxImportSource @emotion/react */
import {
	filterAccountJobs,
	readJobsSearchFilter,
	readJobsViewFilter,
	type AccountJobsViewFilter,
} from '#client/routes/account-jobs-filter.ts'
import { updateJobs } from '#start/server/account-mutations'
import {
	type AccountJobListItem,
	type AccountJobsLoaderData,
} from '#universal/loader-data.ts'
import {
	useIsMutating,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { restorePageResource } from '../page-mutation-cache.ts'
import { pageQueryOrg, scopedPageResource } from '../page-query-scope.ts'
import {
	renderAccountJobDetail,
	renderJobDetailPlaceholder,
} from './account-jobs-detail.tsx'
import { needsJobDetailRefresh } from './account-jobs-query.ts'
import {
	emptyJobsMessage,
	jobsRoute,
	packageLabel,
	statusColor,
	statusLabel,
	viewFilterOptions,
	type AccountJobsActionPayload,
} from './account-jobs-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import {
	RecordChips,
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordCellClamp,
} from './record-table.tsx'

const clampedCellCss = recordCellClamp(28)

type MessageTone = 'info' | 'error'

export function AccountJobsPage({
	payload,
	currentHref,
}: {
	payload: AccountJobsLoaderData
	currentHref: string
}) {
	const { username, jobs, selectedJob } = payload

	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<MessageTone>('info')
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function updateFilters(next: {
		search?: string
		view?: AccountJobsViewFilter
	}) {
		const matchedUrl = new URL(currentHref, 'http://localhost')
		// Compose consecutive filter edits from Router's latest search, even
		// before the previous navigation commits. Pin the destination to this
		// rendered page so a retained toolbar cannot edit a different page.
		const samePage = router.latestLocation.pathname === matchedUrl.pathname
		return router.navigate({
			to: matchedUrl.pathname,
			replace: true,
			resetScroll: false,
			search: (previous: Record<string, unknown>) => {
				const search: Record<string, unknown> = samePage
					? { ...previous }
					: Object.fromEntries(matchedUrl.searchParams)
				if (next.search !== undefined) {
					if (next.search) search.q = next.search
					else delete search.q
				}
				if (next.view !== undefined) {
					if (next.view === 'active') delete search.view
					else search.view = next.view
				}
				return search
			},
		})
	}

	function showMessage(nextMessage: string | null, tone: MessageTone = 'info') {
		setMessage(nextMessage)
		setMessageTone(tone)
	}

	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const mutationKey = ['jobs', actorKey, pageQueryOrg(currentHref)] as const
	const isMutating = useIsMutating({ mutationKey }) > 0
	type JobsQueryData = { payload: AccountJobsLoaderData }
	const jobsMutation = useMutation({
		mutationKey,
		mutationFn: async (input: {
			body: Record<string, unknown>
			href: string
			failureMessage: string
		}) => {
			return updateJobs({
				data: {
					body: input.body,
					orgSlug: pageQueryOrg(input.href) ?? undefined,
					search: new URL(input.href, 'https://kody.local').search,
				},
			})
		},
		onMutate: async ({ body, href }) => {
			const resource = scopedPageResource(actorKey, 'loadJobsPage', href)
			await queryClient.cancelQueries(resource)
			const snapshot = queryClient.getQueriesData<JobsQueryData>(resource)
			queryClient.setQueriesData<JobsQueryData>(
				resource,
				(data) =>
					data && { ...data, payload: optimisticJobs(data.payload, body) },
			)
			return { snapshot, resource }
		},
		onError: async (_error, input, context) => {
			restorePageResource(queryClient, context?.snapshot)
			void queryClient.invalidateQueries({
				...scopedPageResource(actorKey, 'loadJobsPage', input.href),
			})
		},
		onSuccess: async (accepted, { body, href }) => {
			const resource = scopedPageResource(actorKey, 'loadJobsPage', href)
			await queryClient.cancelQueries({
				...resource,
				predicate: (query) =>
					resource.predicate(query) && query.state.data !== undefined,
			})
			queryClient.setQueriesData<JobsQueryData>(
				resource,
				(data) =>
					data && {
						...data,
						payload: {
							...data.payload,
							username: accepted.username,
							jobs: accepted.jobs,
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
				...resource,
				predicate: (query) =>
					resource.predicate(query) &&
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
		if (queryClient.isMutating({ mutationKey })) return
		showMessage(null)
		jobsMutation.mutate(
			{ ...input, href: currentHref },
			{
				onSuccess: (payload) => {
					showMessage(input.successMessage(payload))
					input.afterSuccess?.(payload)
				},
				onError: (error) => {
					showMessage(
						error instanceof Error ? error.message : input.failureMessage,
						'error',
					)
				},
			},
		)
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
		<AccountManagementShell currentHref={currentHref} busy={false}>
			<AccountPageHeader
				title="Jobs"
				description="Inspect scheduled package jobs, toggle the kill switch, and run jobs now. To change or remove a job, edit its package and publish."
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
				<RecordTable
					mode="expand"
					ariaLabel="Scheduled jobs"
					selectedId={selection.selectedId}
					recordLoading={waitingForDetail}
					onNavigate={() => {
						showMessage(null)
					}}
					countLabel={`${filteredJobs.length} of ${jobs.length} shown`}
					emptyLabel={listEmptyMessage ?? 'No jobs match the current filters.'}
					toolbar={
						<>
							<RecordTableSearch
								label="Search jobs"
								placeholder="Search jobs"
								value={
									new URL(currentHref, 'http://localhost').searchParams.get(
										'q',
									) ?? ''
								}
								onInput={(value) => {
									return updateFilters({ search: value })
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
									updateFilters({ view: value })
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
							: jobsRoute.buildDetailHref(
									item.id,
									getCurrentSearch(),
									currentHref,
								),
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
									items={item.expired ? ['Expired'] : []}
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
									currentHref,
									detail,
									isMutating,
									postAction,
									navigateToList: () => {
										navigate(
											jobsRoute.buildListHref(getCurrentSearch(), currentHref),
										)
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
	const update = <T extends AccountJobListItem>(job: T): T => {
		if (job.id !== body.id) return job
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

/** @jsxImportSource @emotion/react */
import { createListDetailRoute } from '#client/list-detail-route.ts'
import {
	filterAccountWorkflows,
	isActiveAccountWorkflow,
	readWorkflowsSearchFilter,
	readWorkflowsViewFilter,
	type AccountWorkflowsViewFilter,
} from '#client/routes/account-workflows-filter.ts'
import { updateWorkflows } from '#start/server/account-mutations'
import {
	type AccountWorkflowListItem,
	type AccountWorkflowRunStatus,
	type AccountWorkflowsLoaderData,
} from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import {
	cardTitleCss,
	descriptionCss,
	getDangerPillCss,
	getGhostButtonCss,
	primaryLinkCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	useIsMutating,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SiteLink } from '../components/site-link.tsx'
import { pageQueryOrg, scopedPageResource } from '../page-query-scope.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	IdValue,
	MetadataGrid,
	TimestampValue,
} from './account-management-components.tsx'
import {
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordBodyCss,
	recordStampCss,
} from './record-table.tsx'
import {
	renderInlineWorkflowNameSubtitle,
	renderWorkflowNameCell,
} from './workflow-name-display.tsx'

type MessageTone = 'info' | 'error'

const workflowsRoute = createListDetailRoute('/account/workflows')

const viewFilterOptions: Array<{
	value: AccountWorkflowsViewFilter
	label: string
}> = [
	{ value: 'active', label: 'Active' },
	{ value: 'history', label: 'History' },
	{ value: 'all', label: 'All' },
]

/**
 * Latch key includes the selected workflow id because detail is loaded with
 * `?selected=`. Client-side `q` / `view` filters are omitted so search typing
 * and filter toggles do not refetch.
 */
function emptyWorkflowsMessage(input: {
	totalCount: number
	filteredCount: number
	view: AccountWorkflowsViewFilter
	search: string
}) {
	if (input.totalCount === 0) {
		return 'No workflow runs yet. Ask Kody to create a deferred or long-running run.'
	}
	if (input.filteredCount > 0) return null
	if (input.search || input.view === 'all') {
		return 'No workflows match the current filters.'
	}
	if (input.view === 'history') {
		return 'No finished workflow runs.'
	}
	return 'No active workflow runs. Switch to History or All to see other runs.'
}

function sourceLabel(workflow: Pick<AccountWorkflowListItem, 'sourceType'>) {
	switch (workflow.sourceType) {
		case 'inline':
			return 'Inline'
		case 'package':
			return 'Package'
		default: {
			const exhaustive: never = workflow.sourceType
			return exhaustive
		}
	}
}

function packageValue(
	username: string,
	workflow: Pick<AccountWorkflowListItem, 'sourceType' | 'kodyId'>,
) {
	if (workflow.sourceType !== 'package' || !workflow.kodyId || !username) {
		return '—'
	}
	return (
		<SiteLink
			href={routes.communityPackage.href({
				username,
				kodyId: workflow.kodyId,
			})}
			css={primaryLinkCss}
		>
			{workflow.kodyId}
		</SiteLink>
	)
}

function statusLabel(status: AccountWorkflowRunStatus | null) {
	if (status === null) return 'Creating'
	switch (status) {
		case 'queued':
			return 'Queued'
		case 'running':
			return 'Running'
		case 'paused':
			return 'Paused'
		case 'waiting':
			return 'Waiting'
		case 'waitingForPause':
			return 'Waiting for pause'
		case 'unknown':
			return 'Unknown'
		case 'complete':
			return 'Complete'
		case 'errored':
			return 'Errored'
		case 'terminated':
			return 'Terminated'
		case 'cancelled':
			return 'Cancelled'
		default: {
			const exhaustive: never = status
			return exhaustive
		}
	}
}

function statusColor(status: AccountWorkflowRunStatus | null) {
	if (status === null) return colors.textMuted
	switch (status) {
		case 'queued':
		case 'waiting':
		case 'waitingForPause':
		case 'paused':
		case 'unknown':
			return colors.textMuted
		case 'running':
			return colors.primary
		case 'complete':
			return colors.primary
		case 'errored':
		case 'terminated':
		case 'cancelled':
			return colors.error
		default: {
			const exhaustive: never = status
			return exhaustive
		}
	}
}

export function AccountWorkflowsPage({
	payload,
	currentHref,
}: {
	payload: AccountWorkflowsLoaderData
	currentHref: string
}) {
	const { username, workflows, selectedWorkflow } = payload
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<MessageTone>('info')
	const [cancelArmed, setCancelArmed] = useState(false)
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const mutationKey = [
		'workflows',
		actorKey,
		pageQueryOrg(currentHref),
	] as const

	const isMutating = useIsMutating({ mutationKey }) > 0
	const router = useRouter()

	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function updateFilters(next: {
		search?: string
		view?: AccountWorkflowsViewFilter
	}) {
		const matchedUrl = new URL(currentHref, 'http://localhost')
		const samePage = router.latestLocation.pathname === matchedUrl.pathname
		return router.navigate({
			to: matchedUrl.pathname,
			replace: true,
			resetScroll: false,
			search: (previous: Record<string, unknown>) => {
				// Keep an in-flight search edit when a second filter changes.
				// Another page's pending search never belongs to this toolbar.
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

	type ActionResult = AccountWorkflowsLoaderData & {
		cancel?: {
			cancelled: boolean
			alreadyTerminal: boolean
			status: AccountWorkflowRunStatus | null
		}
	}
	const mutation = useMutation({
		mutationKey,
		mutationFn: async (input: {
			body: Record<string, unknown>
			href: string
			failureMessage: string
		}) => {
			return updateWorkflows({
				data: {
					body: input.body,
					orgSlug: pageQueryOrg(input.href) ?? undefined,
					search: new URL(input.href, 'https://kody.local').search,
				},
			})
		},
		onSuccess: async (accepted, { href }) => {
			const resource = scopedPageResource(actorKey, 'loadWorkflowsPage', href)
			await queryClient.cancelQueries({
				...resource,
				predicate: (query) =>
					resource.predicate(query) && query.state.data !== undefined,
			})
			queryClient.setQueriesData<{ payload: AccountWorkflowsLoaderData }>(
				resource,
				(data) =>
					data && {
						...data,
						payload: {
							...data.payload,
							username: accepted.username,
							workflows: accepted.workflows,
							selectedWorkflow:
								data.payload.selectedWorkflow?.id ===
								accepted.selectedWorkflow?.id
									? accepted.selectedWorkflow
									: data.payload.selectedWorkflow &&
										  accepted.workflows.some(
												(row) => row.id === data.payload.selectedWorkflow?.id,
										  )
										? {
												...data.payload.selectedWorkflow,
												...accepted.workflows.find(
													(row) => row.id === data.payload.selectedWorkflow?.id,
												),
											}
										: null,
						},
					},
			)
			void queryClient.invalidateQueries({
				...resource,
				predicate: (query) => {
					if (!resource.predicate(query)) return false
					const selected =
						workflowsRoute.getSelection(String(query.queryKey[3])).selectedId ??
						new URL(
							String(query.queryKey[3]),
							'https://kody.local',
						).searchParams.get('selected')
					return Boolean(selected && selected !== accepted.selectedWorkflow?.id)
				},
			})
			for (const dependent of ['loadWaitingPage', 'loadActivityPage'])
				void queryClient.invalidateQueries(
					scopedPageResource(actorKey, dependent, href),
				)
		},
	})
	function postAction(input: {
		body: Record<string, unknown>
		successMessage: (payload: ActionResult) => string | null
		failureMessage: string
	}) {
		if (queryClient.isMutating({ mutationKey })) return
		showMessage(null)
		setCancelArmed(false)
		mutation.mutate(
			{ ...input, href: currentHref },
			{
				onSuccess: (accepted) => showMessage(input.successMessage(accepted)),
				onError: (error) => showMessage(error.message, 'error'),
			},
		)
	}

	const status = 'ready'
	const selection = workflowsRoute.getSelection(currentHref)
	const search = readWorkflowsSearchFilter(currentHref)
	const view = readWorkflowsViewFilter(currentHref)
	const filteredWorkflows = filterAccountWorkflows(workflows, {
		view,
		search,
	})
	const listEmptyMessage = emptyWorkflowsMessage({
		totalCount: workflows.length,
		filteredCount: filteredWorkflows.length,
		view,
		search,
	})
	const detail =
		selectedWorkflow && selectedWorkflow.id === selection.selectedId
			? selectedWorkflow
			: null
	const listMatch =
		workflows.find((item) => item.id === selection.selectedId) ?? null
	const waitingForDetail = false
	const showWorkflowNotFound =
		selection.selectedId != null &&
		!detail &&
		!waitingForDetail &&
		status === 'ready'
	const canCancel = detail ? isActiveAccountWorkflow(detail) : false

	return (
		<AccountManagementShell currentHref={currentHref} busy={false}>
			<AccountPageHeader
				title="Workflows"
				description="Inspect deferred and long-running workflow runs — inline or package-backed — including status, schedule time, and errors. Cancel a run that has not finished yet."
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
					ariaLabel="Workflow runs"
					selectedId={selection.selectedId}
					recordLoading={waitingForDetail}
					onNavigate={() => {
						setCancelArmed(false)
						showMessage(null)
					}}
					countLabel={`${filteredWorkflows.length} of ${workflows.length} shown`}
					emptyLabel={
						listEmptyMessage ?? 'No workflows match the current filters.'
					}
					toolbar={
						<>
							<RecordTableSearch
								label="Search workflows"
								placeholder="Search workflows"
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
								label="Workflows view filter"
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
						{ key: 'name', label: 'Workflow', primary: true },
						{ key: 'source', label: 'Source', drop: 2 },
						{ key: 'status', label: 'Status' },
						{ key: 'runAt', label: 'Run at', drop: 1 },
						{ key: 'updated', label: 'Updated', drop: 3 },
					]}
					rows={filteredWorkflows.map((item) => ({
						id: item.id,
						href: isMutating
							? undefined
							: workflowsRoute.buildDetailHref(
									item.id,
									getCurrentSearch(),
									currentHref,
								),
						cells: {
							name: renderWorkflowNameCell({
								name: item.workflowName,
								idempotencyKey: item.idempotencyKey,
							}),
							source: sourceLabel(item),
							status: (
								<span css={{ color: statusColor(item.status) }}>
									{statusLabel(item.status)}
								</span>
							),
							runAt: (
								<span css={recordStampCss}>
									<TimestampValue value={item.runAt} />
								</span>
							),
							updated: (
								<span css={recordStampCss}>
									<TimestampValue value={item.updatedAt} />
								</span>
							),
						},
					}))}
					record={
						detail ? (
							<section css={recordBodyCss}>
								<div css={{ display: 'grid', gap: spacing.xs }}>
									<h2 css={cardTitleCss}>{detail.workflowName}</h2>
									{renderInlineWorkflowNameSubtitle({
										displayedName: detail.workflowName,
										idempotencyKey: detail.idempotencyKey,
									})}
									<p css={descriptionCss}>
										{detail.sourceType === 'package'
											? 'Package workflow run. Cancel stops the underlying Cloudflare Workflow instance when it has not finished yet.'
											: 'Inline workflow run. Cancel stops the underlying Cloudflare Workflow instance when it has not finished yet.'}
									</p>
								</div>

								<MetadataGrid
									items={[
										{
											label: 'Status',
											value: (
												<span css={{ color: statusColor(detail.status) }}>
													{statusLabel(detail.status)}
												</span>
											),
										},
										{
											label: 'Source',
											value: sourceLabel(detail),
										},
										{
											label: 'Package',
											value: packageValue(username, detail),
										},
										{
											label: 'Export',
											value: detail.exportName ?? '—',
										},
										{
											label: 'Run at',
											value: <TimestampValue value={detail.runAt} />,
										},
										{
											label: 'Plan date',
											value: detail.planDate ?? '—',
										},
										{
											label: 'Created',
											value: <TimestampValue value={detail.createdAt} />,
										},
										{
											label: 'Updated',
											value: <TimestampValue value={detail.updatedAt} />,
										},
										{
											label: 'Completed',
											value: <TimestampValue value={detail.completedAt} />,
										},
										{
											label: 'Idempotency key',
											value: (
												<IdValue
													value={detail.idempotencyKey}
													label="idempotency key"
												/>
											),
										},
										{
											label: 'Workflow id',
											value: <IdValue value={detail.id} label="workflow id" />,
										},
										{
											label: 'Kody id',
											value: detail.kodyId ? (
												<IdValue value={detail.kodyId} label="kody id" />
											) : (
												'—'
											),
										},
										{
											label: 'Source id',
											value: detail.sourceId ? (
												<IdValue value={detail.sourceId} label="source id" />
											) : (
												'—'
											),
										},
									]}
								/>

								{detail.lastError ? (
									<AccountManagementMessage tone="error">
										{detail.lastError}
									</AccountManagementMessage>
								) : null}

								{canCancel ? (
									<div
										css={{
											display: 'flex',
											gap: spacing.sm,
											flexWrap: 'wrap',
										}}
									>
										<button
											type="button"
											disabled={isMutating}
											css={dangerButtonCss}
											onBlur={() => setCancelArmed(false)}
											onClick={() => {
												if (!cancelArmed) {
													setCancelArmed(true)
													return
												}
												void postAction({
													body: { action: 'cancel', id: detail.id },
													successMessage: (payload) =>
														payload.cancel?.alreadyTerminal
															? `Workflow already finished with status "${statusLabel(payload.cancel.status)}".`
															: 'Cancelled workflow run.',
													failureMessage: 'Unable to cancel workflow run.',
												})
											}}
										>
											{cancelArmed ? 'Confirm cancel' : 'Cancel run'}
										</button>
										{cancelArmed ? (
											<button
												type="button"
												disabled={isMutating}
												onClick={() => {
													setCancelArmed(false)
												}}
												css={secondaryButtonCss}
											>
												Keep running
											</button>
										) : null}
									</div>
								) : null}
							</section>
						) : waitingForDetail ? (
							<div css={{ ...recordBodyCss, gap: spacing.sm }}>
								<h2
									css={{
										margin: 0,
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
										color: colors.text,
									}}
								>
									{listMatch?.workflowName ?? 'Loading workflow'}
								</h2>
								{listMatch
									? renderInlineWorkflowNameSubtitle({
											displayedName: listMatch.workflowName,
											idempotencyKey: listMatch.idempotencyKey,
										})
									: null}
								<p css={{ margin: 0, color: colors.textMuted }}>
									Loading workflow details…
								</p>
							</div>
						) : showWorkflowNotFound ? (
							<div css={{ ...recordBodyCss, gap: spacing.sm }}>
								<h2
									css={{
										margin: 0,
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
										color: colors.text,
									}}
								>
									Workflow not found
								</h2>
								<p css={{ margin: 0, color: colors.textMuted }}>
									This workflow run does not exist for this account or is
									unavailable.
								</p>
							</div>
						) : null
					}
				/>
			) : null}
		</AccountManagementShell>
	)
}

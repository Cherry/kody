/** @jsxImportSource @emotion/react */
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import { useMutation } from '@tanstack/react-query'
import { toast } from '#client/toast.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { SiteLink } from '../components/site-link.tsx'
import { createListDetailRoute } from '#client/list-detail-route.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	type AccountMemoryListItem,
	type AccountMemoriesLoaderData,
} from '#universal/loader-data.ts'
import { buildMemoriesExportFilename } from '#universal/memory-export.ts'
import { routes } from '#universal/routes.ts'
import { matchesSearchQuery } from '#client/search-filter.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	MetadataGrid,
	TimestampValue,
} from './account-management-components.tsx'
import {
	RecordChips,
	RecordTable,
	RecordTableSearch,
	recordBodyCss,
	recordCellClamp,
} from './record-table.tsx'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	cardTitleCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getDangerPillCss,
	getGhostButtonCss,
} from '#universal/styles/style-primitives.ts'

const clampedCellCss = recordCellClamp(30)

const accountMemoriesApiPath = routes.accountMemoriesApi.href()
const accountMemoriesExportPath = routes.accountMemoriesExport.href()
const memoriesRoute = createListDetailRoute('/account/memories')

type MessageTone = 'info' | 'error'
type DeleteMode = 'soft' | 'hard' | null

function readSearchFilter(href: string) {
	return new URL(href, 'http://localhost').searchParams.get('q')?.trim() ?? ''
}

function readIncludeDeleted(href: string) {
	const raw = new URL(href, 'http://localhost').searchParams
		.get('includeDeleted')
		?.trim()
		.toLowerCase()
	return raw === '1' || raw === 'true' || raw === 'yes'
}

function filterMemories(
	memories: Array<AccountMemoryListItem>,
	search: string,
) {
	return memories.filter((memory) =>
		matchesSearchQuery(search, [
			memory.subject,
			memory.category,
			memory.status,
			memory.summary,
			...memory.tags,
		]),
	)
}

function buildMemoriesExportHref(includeDeleted: boolean) {
	if (!includeDeleted) return accountMemoriesExportPath
	const requestUrl = new URL(accountMemoriesExportPath, 'http://localhost')
	requestUrl.searchParams.set('includeDeleted', 'true')
	return `${requestUrl.pathname}${requestUrl.search}`
}

function statusLabel(status: AccountMemoryListItem['status']) {
	switch (status) {
		case 'active':
			return 'Active'
		case 'archived':
			return 'Archived'
		case 'deleted':
			return 'Deleted'
		default:
			status satisfies never
			return 'Unknown'
	}
}

function statusColor(status: AccountMemoryListItem['status']) {
	switch (status) {
		case 'active':
			return colors.primary
		case 'archived':
			return colors.textMuted
		case 'deleted':
			return colors.error
		default:
			status satisfies never
			return colors.textMuted
	}
}

function formatOptional(value: string | null | undefined) {
	return value?.trim() ? value : '—'
}

export function AccountMemoriesPage({
	payload,
	currentHref,
}: {
	payload: AccountMemoriesLoaderData
	currentHref: string
}) {
	const [actionState, setActionState] = useState<'idle' | 'busy'>('idle')
	const memories = payload.memories
	const selectedMemory = payload.selectedMemory
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<MessageTone>('info')
	const [deleteMode, setDeleteMode] = useState<DeleteMode>(null)
	const invalidatePages = usePageInvalidation(mutationResources)
	const captureSubmitter = useSubmitterScope()
	const deleteMutation = useMutation({
		mutationKey: ['memories', currentHref],
		mutationFn: async (input: {
			memoryId: string
			force: boolean
			href: string
			isCurrentSubmitter: () => boolean
		}) => {
			const { isCurrentSubmitter } = input
			const response = await fetch(accountMemoriesApiPath, {
				method: 'POST',
				referrer: orgAccountApiReferrer(input.href),
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'delete',
					memoryId: input.memoryId,
					force: input.force,
				}),
			})
			if (response.status === 401) {
				if (isCurrentSubmitter()) window.location.assign('/login')
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<
				AccountMemoriesLoaderData & { error?: string; ok?: boolean }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to delete memory.')
			}

			return payload
		},
		onMutate: () => invalidatePages,
		onSettled: (_data, _error, _input, reconcile) => reconcile?.(),
		onError: (error) => toast.error(error.message),
	})
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({
			to: relocateAccountHref(href, currentHref),
			resetScroll: false,
		})

	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function updateFilters(next: { search?: string; includeDeleted?: boolean }) {
		const matchedUrl = new URL(currentHref, 'http://localhost')
		const samePage = router.latestLocation.pathname === matchedUrl.pathname
		return router.navigate({
			to: matchedUrl.pathname,
			replace: true,
			resetScroll: false,
			search: (previous) => {
				// Keep an in-flight search edit when a second filter changes.
				// Another page's pending search never belongs to this toolbar.
				const search: Record<string, unknown> = samePage
					? { ...previous }
					: Object.fromEntries(matchedUrl.searchParams)
				if (next.search !== undefined) {
					if (next.search) search.q = next.search
					else delete search.q
				}
				if (next.includeDeleted !== undefined) {
					if (next.includeDeleted) search.includeDeleted = 'true'
					else delete search.includeDeleted
				}
				return search
			},
		})
	}

	function showMessage(nextMessage: string | null, tone: MessageTone = 'info') {
		setMessage(nextMessage)
		setMessageTone(tone)
	}

	function clearDeleteMode() {
		setDeleteMode(null)
	}

	async function postDelete(input: { memoryId: string; force: boolean }) {
		if (actionState !== 'idle') return
		setActionState('busy')
		showMessage(null)
		const isCurrentSubmitter = captureSubmitter()
		try {
			await deleteMutation.mutateAsync({
				...input,
				href: currentHref,
				isCurrentSubmitter,
			})
			if (!isCurrentSubmitter()) return
			clearDeleteMode()
			setActionState('idle')
			showMessage(
				input.force ? 'Permanently deleted memory.' : 'Soft-deleted memory.',
			)
			navigate(memoriesRoute.buildListHref(getCurrentSearch()))
		} catch (error) {
			if (!isCurrentSubmitter()) return
			setActionState('idle')
			setDeleteMode(null)
			showMessage(
				error instanceof Error ? error.message : 'Unable to delete memory.',
				'error',
			)
		}
	}

	const pending = false
	const status = 'ready'
	const [lastPayload, setLastPayload] = useState(payload)
	if (lastPayload !== payload) {
		setLastPayload(payload)
		clearDeleteMode()
	}

	const isMutating = actionState !== 'idle'
	const selection = memoriesRoute.getSelection(currentHref)
	const search = readSearchFilter(currentHref)
	const includeDeleted = readIncludeDeleted(currentHref)
	const filteredMemories = filterMemories(memories, search)
	const detailMemory =
		selectedMemory?.id === selection.selectedId ? selectedMemory : null
	const waitingForDetail =
		selection.selectedId != null && !detailMemory && pending
	const showMemoryNotFound =
		selection.selectedId != null &&
		!detailMemory &&
		!waitingForDetail &&
		status === 'ready'

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Memories"
				description="Long-term memories Kody stores for your account. Agents create and update them; you can browse, filter, and delete here."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' ? (
				<>
					<p
						css={{
							margin: 0,
							color: colors.textMuted,
							fontSize: typography.fontSize.sm,
						}}
					>
						Showing up to the 100 most recent memories. Agents create them
						through verify and upsert.
					</p>
					<RecordTable
						mode="expand"
						ariaLabel="Saved memories"
						selectedId={selection.selectedId}
						recordLoading={waitingForDetail}
						onNavigate={() => {
							setDeleteMode(null)
							showMessage(null)
						}}
						countLabel={`${filteredMemories.length} of ${memories.length} shown`}
						emptyLabel={
							memories.length === 0
								? 'No memories yet. Agents create them through verify and upsert.'
								: 'No memories match the current filters.'
						}
						toolbar={
							<>
								<RecordTableSearch
									label="Search memories"
									placeholder="Search subject, category, tags, summary"
									value={
										new URL(currentHref, 'http://localhost').searchParams.get(
											'q',
										) ?? ''
									}
									onInput={(value) => {
										return updateFilters({ search: value })
									}}
								/>
								<label
									css={{
										display: 'flex',
										alignItems: 'center',
										gap: spacing.xs,
										flex: 'none',
										color: colors.textMuted,
										fontSize: typography.fontSize.sm,
										whiteSpace: 'nowrap',
									}}
								>
									<input
										type="checkbox"
										checked={includeDeleted}
										disabled={isMutating}
										onChange={(event) => {
											updateFilters({
												includeDeleted: event.currentTarget.checked,
											})
										}}
									/>
									Include deleted
								</label>
								<SiteLink
									href={buildMemoriesExportHref(includeDeleted)}
									download={buildMemoriesExportFilename()}
									css={secondaryButtonCss}
								>
									Export
								</SiteLink>
							</>
						}
						columns={[
							{ key: 'subject', label: 'Subject', primary: true },
							{ key: 'status', label: 'Status' },
							{ key: 'category', label: 'Category', drop: 2 },
							{ key: 'tags', label: 'Tags', drop: 1 },
							{ key: 'summary', label: 'Summary', drop: 3 },
						]}
						rows={filteredMemories.map((item) => ({
							id: item.id,
							// A delete or restore is in flight; navigating away from
							// the row being mutated would strand the confirmation.
							href: isMutating
								? undefined
								: memoriesRoute.buildDetailHref(
										item.id,
										getCurrentSearch(),
										currentHref,
									),
							cells: {
								subject: <span css={clampedCellCss}>{item.subject}</span>,
								status: (
									<span css={{ color: statusColor(item.status) }}>
										{statusLabel(item.status)}
									</span>
								),
								category: item.category ?? '—',
								tags: <RecordChips items={item.tags} empty="—" />,
								summary: <span css={clampedCellCss}>{item.summary}</span>,
							},
						}))}
						record={
							detailMemory ? (
								<section css={recordBodyCss}>
									<div css={{ display: 'grid', gap: spacing.xs }}>
										<h2 css={cardTitleCss}>{detailMemory.subject}</h2>
										<p css={descriptionCss}>{detailMemory.summary}</p>
									</div>

									<MetadataGrid
										items={[
											{
												label: 'Status',
												value: (
													<span
														css={{
															color: statusColor(detailMemory.status),
														}}
													>
														{statusLabel(detailMemory.status)}
													</span>
												),
											},
											{
												label: 'Category',
												value: formatOptional(detailMemory.category),
											},
											{
												label: 'Tags',
												value:
													detailMemory.tags.length > 0
														? detailMemory.tags.join(', ')
														: '—',
											},
											{
												label: 'Dedupe key',
												value: formatOptional(detailMemory.dedupeKey),
											},
											{
												label: 'Created',
												value: (
													<TimestampValue value={detailMemory.createdAt} />
												),
											},
											{
												label: 'Updated',
												value: (
													<TimestampValue value={detailMemory.updatedAt} />
												),
											},
											{
												label: 'Last accessed',
												value: (
													<TimestampValue value={detailMemory.lastAccessedAt} />
												),
											},
											{
												label: 'Deleted',
												value: (
													<TimestampValue value={detailMemory.deletedAt} />
												),
											},
										]}
									/>

									<div css={fieldCss}>
										<span css={fieldLabelCss}>Details</span>
										<p
											css={{
												margin: 0,
												padding: spacing.sm,
												borderRadius: radius.md,
												border: `1px solid ${colors.border}`,
												backgroundColor: colors.background,
												color: colors.text,
												whiteSpace: 'pre-wrap',
												overflowWrap: 'anywhere',
											}}
										>
											{detailMemory.details.trim() ? detailMemory.details : '—'}
										</p>
									</div>

									<div css={fieldCss}>
										<span css={fieldLabelCss}>Source URIs</span>
										{detailMemory.sourceUris.length === 0 ? (
											<p css={{ margin: 0, color: colors.textMuted }}>—</p>
										) : (
											<ul
												css={{
													margin: 0,
													paddingLeft: spacing.lg,
													display: 'grid',
													gap: spacing.xs,
												}}
											>
												{detailMemory.sourceUris.map((uri) => (
													<li key={uri}>
														<SiteLink
															href={uri}
															target="_blank"
															rel="noreferrer"
															css={{
																color: colors.primary,
																overflowWrap: 'anywhere',
															}}
														>
															{uri}
														</SiteLink>
													</li>
												))}
											</ul>
										)}
									</div>

									<div
										css={{
											display: 'flex',
											gap: spacing.sm,
											flexWrap: 'wrap',
											alignItems: 'center',
										}}
									>
										<button
											type="button"
											disabled={isMutating || detailMemory.status === 'deleted'}
											onClick={() => {
												if (deleteMode !== 'soft') {
													setDeleteMode('soft')
													return
												}
												void postDelete({
													memoryId: detailMemory.id,
													force: false,
												})
											}}
											css={dangerButtonCss}
										>
											{actionState === 'busy' && deleteMode === 'soft'
												? 'Deleting...'
												: deleteMode === 'soft'
													? 'Confirm soft delete'
													: 'Soft delete'}
										</button>
										<button
											type="button"
											disabled={isMutating}
											onClick={() => {
												if (deleteMode !== 'hard') {
													setDeleteMode('hard')
													return
												}
												void postDelete({
													memoryId: detailMemory.id,
													force: true,
												})
											}}
											css={dangerButtonCss}
										>
											{actionState === 'busy' && deleteMode === 'hard'
												? 'Deleting...'
												: deleteMode === 'hard'
													? 'Confirm permanent delete'
													: 'Delete permanently'}
										</button>
										{deleteMode ? (
											<button
												type="button"
												disabled={isMutating}
												onClick={() => {
													setDeleteMode(null)
												}}
												css={secondaryButtonCss}
											>
												Cancel
											</button>
										) : null}
									</div>
								</section>
							) : showMemoryNotFound ? (
								<div css={{ ...recordBodyCss, gap: spacing.sm }}>
									<h2
										css={{
											margin: 0,
											fontSize: typography.fontSize.lg,
											fontWeight: typography.fontWeight.semibold,
											color: colors.text,
										}}
									>
										Memory not found
									</h2>
									<p css={{ margin: 0, color: colors.textMuted }}>
										This memory does not exist for this account or is
										unavailable.
									</p>
								</div>
							) : null
						}
					/>
				</>
			) : null}
		</AccountManagementShell>
	)
}

const mutationResources = [
	'loadMemoriesPage',
	'loadUsagePage',
	'loadOnboarding',
	'loadAccountPage',
] as const

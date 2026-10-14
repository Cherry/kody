/** @jsxImportSource @emotion/react */
import { useSubmitterScope } from '../use-submitter-scope.ts'
import {
	useIsMutating,
	useMutation,
	useQueryClient,
} from '@tanstack/react-query'
import { pageQueryOrg } from '../page-query-scope.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { valuesMutationOptions } from './account-values-query.ts'
import { type CSSObject } from '@emotion/react'
import { useState } from 'react'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { formatTimestampDate } from '../components/local-timestamp.tsx'
import { createListDetailRoute } from '#client/list-detail-route.ts'
import { matchesSearchQuery } from '#client/search-filter.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	MetadataGrid,
	TimestampValue,
	accountInputCss,
	accountTextareaCss,
} from './account-management-components.tsx'
import {
	RecordTable,
	RecordTableSearch,
	recordBodyCss,
	recordCellClamp,
	recordStampCss,
} from './record-table.tsx'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	cardTitleCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getDangerPillCss,
} from '#universal/styles/style-primitives.ts'
import {
	type AccountValueListItem,
	type AccountValuesLoaderData,
} from '#universal/loader-data.ts'

const clampedCellCss = recordCellClamp(28)

const accountValuesApiPath = '/account/values.json'
const accountValuesPath = '/account/values'
const valuesRoute = createListDetailRoute(accountValuesPath)

/**
 * Selection changes need a refetch for full `selectedValue`. The client-side
 * `q` filter does not change the GET response, so it is omitted from the key.
 */
function readSearchFilter(href: string) {
	return new URL(href, 'http://localhost').searchParams.get('q')?.trim() ?? ''
}

function filterValues(values: Array<AccountValueListItem>, search: string) {
	return values.filter((entry) =>
		matchesSearchQuery(search, [
			entry.name,
			entry.description,
			entry.valuePreview,
		]),
	)
}

function formatRelativeTtl(ttlMs: number | null) {
	if (ttlMs == null) return 'No expiry'
	const totalMinutes = Math.max(1, Math.round(ttlMs / 60_000))
	if (totalMinutes < 60) return `${totalMinutes}m`
	const hours = Math.floor(totalMinutes / 60)
	const minutes = totalMinutes % 60
	if (hours < 48) {
		return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
	}
	const days = Math.floor(hours / 24)
	return `${days}d`
}

export function AccountValuesPage({
	payload,
	currentHref,
}: {
	payload: AccountValuesLoaderData
	currentHref: string
}) {
	const { values, selectedValue } = payload
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [deleteArmed, setDeleteArmed] = useState(false)
	const queryClient = useQueryClient()
	const captureSubmitter = useSubmitterScope()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const mutationKey = ['values', actorKey, pageQueryOrg(currentHref)] as const
	const isMutating = useIsMutating({ mutationKey }) > 0
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		router.navigate({ to: href, replace: true, resetScroll: false })

	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function syncRouterLocation(nextPath: string) {
		navigate(nextPath)
	}

	function buildHrefWithUpdatedSearch(search: string) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		if (search) nextUrl.searchParams.set('q', search)
		else nextUrl.searchParams.delete('q')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function showMessage(
		nextMessage: string | null,
		tone: 'info' | 'error' = 'info',
	) {
		setMessage(nextMessage)
		setMessageTone(tone)
	}

	const deleteMutation = useMutation(
		valuesMutationOptions(
			queryClient,
			actorKey,
			async ({ name, href }) => {
				const isCurrentSubmitter = captureSubmitter()
				const response = await fetch(accountValuesApiPath, {
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					referrer: orgAccountApiReferrer(href),
					body: JSON.stringify({ action: 'delete', name }),
				})
				if (response.status === 401) {
					if (isCurrentSubmitter()) window.location.assign('/login')
					throw new Error('Please sign in again.')
				}
				const accepted = await readJson<
					AccountValuesLoaderData & { error?: string }
				>(response)
				if (!response.ok || !accepted?.ok)
					throw new Error(accepted?.error || 'Unable to delete value.')
				return accepted
			},
			currentHref,
		),
	)

	function deleteValueEntry() {
		if (!selectedValue || queryClient.isMutating({ mutationKey })) return
		showMessage(null)
		deleteMutation.mutate(
			{ name: selectedValue.name, href: currentHref },
			{
				onSuccess: () => {
					setDeleteArmed(false)
					showMessage('Deleted value.')
					syncRouterLocation(
						valuesRoute.buildListHref(getCurrentSearch(), currentHref),
					)
				},
				onError: (error) => showMessage(error.message, 'error'),
			},
		)
	}

	function resetSelectionState() {
		setDeleteArmed(false)
		showMessage(null)
	}

	const pending = false
	const status = 'ready'

	const selection = valuesRoute.getSelection(currentHref)
	const search = readSearchFilter(currentHref)
	const filteredValues = filterValues(values, search)
	const detail = selectedValue
	const isLoadingSelection =
		selection.selectedId != null &&
		(detail == null || detail.id !== selection.selectedId) &&
		pending
	const showEditor =
		selection.selectedId != null && detail != null && !isLoadingSelection
	const showValueNotFound =
		selection.selectedId != null &&
		detail == null &&
		status === 'ready' &&
		!pending
	const selectedLabel = detail?.name ?? selection.selectedId ?? 'Value'

	const monospaceValueCss: CSSObject = {
		...accountTextareaCss,
		fontFamily: 'monospace',
		fontSize: typography.fontSize.sm,
		minHeight: '10rem',
	}

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Values"
				description="Leftover named rows from an older storage model. New work uses secrets and package storage."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' ? (
				<RecordTable
					mode="expand"
					ariaLabel="Saved values"
					selectedId={selection.selectedId}
					recordLoading={isLoadingSelection}
					onNavigate={resetSelectionState}
					countLabel={`${filteredValues.length} of ${values.length} shown`}
					emptyLabel={
						values.length === 0
							? 'No leftover rows.'
							: 'No leftover rows match the current filters.'
					}
					toolbar={
						<RecordTableSearch
							label="Search values"
							placeholder="Search values"
							value={search}
							onInput={(value) => {
								return replaceLocation(buildHrefWithUpdatedSearch(value))
							}}
						/>
					}
					columns={[
						{ key: 'name', label: 'Name', primary: true },
						{ key: 'description', label: 'Description', drop: 1 },
						{ key: 'preview', label: 'Value', drop: 2 },
						{ key: 'updated', label: 'Updated' },
					]}
					rows={filteredValues.map((entry) => ({
						id: entry.id,
						// A save or delete is in flight; the expanded editor owns
						// the selection until it settles.
						href: isMutating
							? undefined
							: valuesRoute.buildDetailHref(
									entry.id,
									getCurrentSearch(),
									currentHref,
								),
						cells: {
							name: entry.name,
							description: (
								<span css={clampedCellCss}>{entry.description || '—'}</span>
							),
							preview: (
								<span css={[clampedCellCss, { fontFamily: 'monospace' }]}>
									{entry.valuePreview || '—'}
								</span>
							),
							updated: (
								<span css={recordStampCss}>
									{formatTimestampDate(entry.updatedAt)}
								</span>
							),
						},
					}))}
					record={
						isLoadingSelection ? (
							<p css={{ margin: 0, color: colors.textMuted }}>Loading value…</p>
						) : showEditor ? (
							<div css={recordBodyCss}>
								<div css={{ display: 'grid', gap: spacing.xs }}>
									<h2 css={cardTitleCss}>{selectedLabel}</h2>
									<p css={descriptionCss}>
										Read-only leftover row. Move the contents to memories,
										package storage, a repo, or secrets, then delete.
									</p>
								</div>

								<label css={fieldCss}>
									<span css={fieldLabelCss}>Name</span>
									<input
										data-field-ring
										name="name"
										type="text"
										value={detail?.name ?? ''}
										readOnly
										css={{
											...accountInputCss,
											color: colors.textMuted,
											cursor: 'default',
										}}
									/>
								</label>

								<label css={fieldCss}>
									<span css={fieldLabelCss}>Description</span>
									<input
										data-field-ring
										name="description"
										type="text"
										value={detail?.description ?? ''}
										readOnly
										css={{
											...accountInputCss,
											color: colors.textMuted,
											cursor: 'default',
										}}
									/>
								</label>

								<label css={fieldCss}>
									<span css={fieldLabelCss}>Value</span>
									<textarea
										data-field-ring
										name="value"
										value={detail?.value ?? ''}
										readOnly
										css={{
											...monospaceValueCss,
											color: colors.textMuted,
											cursor: 'default',
										}}
									/>
								</label>

								{detail ? (
									<MetadataGrid
										items={[
											{
												label: 'Scope',
												value: detail.scope,
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
												label: 'TTL',
												value: formatRelativeTtl(detail.ttlMs),
											},
										]}
									/>
								) : null}

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
										onBlur={() => setDeleteArmed(false)}
										onClick={() => {
											if (deleteArmed) {
												setDeleteArmed(false)
												void deleteValueEntry()
											} else setDeleteArmed(true)
										}}
									>
										{isMutating
											? 'Deleting...'
											: deleteArmed
												? 'Confirm delete'
												: 'Delete'}
									</button>
								</div>
							</div>
						) : showValueNotFound ? (
							<div css={{ ...recordBodyCss, gap: spacing.sm }}>
								<h2
									css={{
										margin: 0,
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
										color: colors.text,
									}}
								>
									Value not found
								</h2>
								<p css={{ margin: 0, color: colors.textMuted }}>
									This value does not exist for this account or is managed by
									another settings page.
								</p>
							</div>
						) : null
					}
				/>
			) : null}
		</AccountManagementShell>
	)
}

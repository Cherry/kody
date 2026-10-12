/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { type CSSObject } from '@emotion/react'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
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
	type AccountValueDetail,
	type AccountValueListItem,
	type AccountValuesLoaderData,
} from '#universal/loader-data.ts'

const clampedCellCss = recordCellClamp(28)

type EditorState = {
	name: string
	description: string
	value: string
}

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

function createEmptyEditorState(): EditorState {
	return {
		name: '',
		description: '',
		value: '',
	}
}

function createEditorStateFromDetail(detail: AccountValueDetail): EditorState {
	return {
		name: detail.name,
		description: detail.description,
		value: detail.value,
	}
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
	const [saveState, setSaveState] = useState<'idle' | 'deleting'>('idle')
	const [values, setValues] = useState<Array<AccountValueListItem>>(
		payload.values,
	)
	const [selectedValue, setSelectedValue] = useState<AccountValueDetail | null>(
		payload.selectedValue,
	)
	const [editorState, setEditorState] = useState(
		payload.selectedValue
			? createEditorStateFromDetail(payload.selectedValue)
			: createEmptyEditorState(),
	)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [deleteArmed, setDeleteArmed] = useState(false)
	const invalidatePages = usePageInvalidation(mutationResources)
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		void router.navigate({ to: href, replace: true, resetScroll: false })

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

	function applyPayload(next: AccountValuesLoaderData) {
		setValues(next.values)
		setSelectedValue(next.selectedValue)
		setEditorState(
			next.selectedValue
				? createEditorStateFromDetail(next.selectedValue)
				: createEmptyEditorState(),
		)
		setDeleteArmed(false)
	}

	async function deleteValueEntry() {
		if (!selectedValue || saveState !== 'idle') return
		setSaveState('deleting')
		showMessage(null)
		try {
			const response = await fetch(accountValuesApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					action: 'delete',
					name: selectedValue.name,
				}),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AccountValuesLoaderData & { error?: string; ok?: boolean }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to delete value.')
			}
			applyPayload(payload)
			setSelectedValue(null)
			setEditorState(createEmptyEditorState())
			setDeleteArmed(false)
			setSaveState('idle')
			showMessage('Deleted value.')
			void invalidatePages()
			syncRouterLocation(valuesRoute.buildListHref(getCurrentSearch()))
		} catch (error) {
			setSaveState('idle')
			showMessage(
				error instanceof Error ? error.message : 'Unable to delete value.',
				'error',
			)
		}
	}

	function resetSelectionState() {
		setDeleteArmed(false)
		showMessage(null)
	}

	const pending = false
	const status = 'ready'
	const [lastPayload, setLastPayload] = useState(payload)
	if (lastPayload !== payload) {
		setLastPayload(payload)
		applyPayload(payload)
	}

	const selection = valuesRoute.getSelection(currentHref)
	const search = readSearchFilter(currentHref)
	const filteredValues = filterValues(values, search)
	const isMutating = saveState !== 'idle'
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
								replaceLocation(buildHrefWithUpdatedSearch(value))
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
							: valuesRoute.buildDetailHref(entry.id, getCurrentSearch()),
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
										value={editorState.name}
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
										value={editorState.description}
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
										value={editorState.value}
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
										{saveState === 'deleting'
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

const mutationResources = ['loadValuesPage', 'loadUsagePage'] as const

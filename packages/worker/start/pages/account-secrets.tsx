/** @jsxImportSource @emotion/react */
import { relocateAccountHref } from '#universal/org-pages.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { useMutation } from '@tanstack/react-query'
import { toast } from '#client/toast.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { type CSSObject } from '@emotion/react'
import { type AccountSecretsLoaderData } from '#universal/loader-data.ts'
import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { buildAccountSecretPath } from '@kody-internal/shared/account-secret-route.ts'
import { type ListDetailSelection } from '#client/list-detail-route.ts'
import {
	type ApprovalAction,
	accountSecretsApiPath,
	getScopeLabel,
	readJson,
} from '#client/routes/account-approval-shared.ts'
import { Combobox, type ComboboxOption } from '../components/combobox.tsx'
import { getPillButtonCss } from '#universal/styles/style-primitives.ts'
import { getNewSecretValueAutofocusKey } from '#client/routes/new-secret-query.ts'
import { normalizeAllowedHosts } from '#client/routes/secret-normalization.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import {
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordCellClamp,
	recordStampCss,
} from './record-table.tsx'
import {
	isPackageApprovalHref,
	isPackageSecretApprovalAlreadyGranted,
	renderAlreadyAddedNotice,
	renderPackageSecretApprovalPage,
	renderSecretApprovalCard,
} from './account-secrets-approval.tsx'
import { SecretEditor } from './account-secrets-editor.tsx'
import {
	type SecretFilterScope,
	buildBaseSecretsHref,
	buildNewSecretHref,
	buildSecretHref,
	collectRepeatedTextRows,
	createEditorStateFromNewSecretQuery,
	createEditorStateFromSecret,
	createEmptyEditorState,
	filterSecrets,
	formatRelativeTtl,
	getAlreadyAddedNotice,
	getDataRefreshKey,
	readFilterState,
	secretsBasePath,
	secretsRoute,
} from './account-secrets-shared.ts'

const clampedCellCss = recordCellClamp(26)

/**
 * A fixed measure that fits a package name beside the scope select on a wide
 * row. On a narrow container it takes a row of its own: sharing one with the
 * select squeezed both below their labels ("All sco…").
 */
const packageFilterSlotCss: CSSObject = {
	flex: '0 1 15rem',
	minWidth: '9rem',
	'@container (max-width: 620px)': { flex: '1 1 100%' },
}

export function AccountSecretsPage({
	payload,
	currentHref,
}: {
	payload: AccountSecretsLoaderData
	currentHref: string
}) {
	const packageOptions = payload.packageOptions
	const packagesById = new Map(
		payload.packages.map((pkg) => [
			pkg.id,
			{ kodyId: pkg.kodyId, name: pkg.name },
		]),
	)
	const secrets = payload.secrets
	const selectedSecret = payload.selectedSecret
	const approval = payload.approval
		? {
				...payload.approval,
				names: payload.approval.names.length
					? payload.approval.names
					: [payload.approval.name],
			}
		: null
	const [editorState, setEditorState] = useState(
		secretsRoute.getSelection(currentHref).isCreating
			? createEditorStateFromNewSecretQuery(payload.packageOptions, currentHref)
			: payload.selectedSecret
				? createEditorStateFromSecret(payload.selectedSecret)
				: createEmptyEditorState(payload.packageOptions),
	)
	const [savedEditorState, setSavedEditorState] = useState(editorState)
	const [message, setMessage] = useState<string | null>(
		payload.approvalError ?? null,
	)
	const [submittingApprovalAction, setSubmittingApprovalAction] =
		useState<ApprovalAction | null>(null)
	const [completedPackageApproval, setCompletedPackageApproval] =
		useState<ApprovalAction | null>(null)
	const [packageApprovalHref, setPackageApprovalHref] = useState<string | null>(
		currentHref,
	)
	const [saveState, setSaveState] = useState<'idle' | 'saving' | 'deleting'>(
		'idle',
	)
	const [showSecretValue, setShowSecretValue] = useState(false)
	const invalidatePages = usePageInvalidation(mutationResources)
	const secretsMutation = useMutation({
		mutationKey: ['secrets', currentHref],
		mutationFn: async (input: {
			url: string
			href: string
			body: Record<string, unknown>
		}) => {
			const response = await fetch(input.url, {
				method: 'POST',
				referrer: orgAccountApiReferrer(input.href),
				credentials: 'include',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(input.body),
			})
			const result = await readJson<
				AccountSecretsLoaderData & { error?: string }
			>(response)
			if (!response.ok || !result?.ok)
				throw new Error(result?.error ?? 'Unable to update secrets.')
			return result
		},
		onSuccess: () => invalidatePages(),
		onError: (error) => toast.error(error.message),
	})
	const router = useRouter()
	const [deleteArmed, setDeleteArmed] = useState(false)
	const navigate = (href: string) =>
		void router.navigate({
			to: relocateAccountHref(href, currentHref),
			resetScroll: false,
		})

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function buildHrefWithUpdatedFilters(
		nextFilters: Partial<ReturnType<typeof readFilterState>>,
		options?: { pathname?: string },
	) {
		const currentUrl = new URL(getCurrentHref(), 'http://localhost')
		const filters = {
			...readFilterState(currentUrl.toString(), packageOptions),
			...nextFilters,
		}
		const nextUrl = new URL(currentUrl.toString())
		if (options?.pathname) {
			nextUrl.pathname = options.pathname
		}
		if (filters.search) nextUrl.searchParams.set('q', filters.search)
		else nextUrl.searchParams.delete('q')
		if (filters.scope === 'all') nextUrl.searchParams.delete('scope')
		else nextUrl.searchParams.set('scope', filters.scope)
		if (filters.packageId)
			nextUrl.searchParams.set('package', filters.packageId)
		else nextUrl.searchParams.delete('package')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function updateFilters(next: Partial<ReturnType<typeof readFilterState>>) {
		const matchedUrl = new URL(currentHref, 'http://localhost')
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
				if (next.scope !== undefined) {
					if (next.scope === 'all') delete search.scope
					else search.scope = next.scope
					if (next.scope === 'user') delete search.package
				}
				if (next.packageId !== undefined) {
					if (next.packageId) search.package = next.packageId
					else delete search.package
				}
				return search
			},
		})
	}

	function applyPayload(
		payload: AccountSecretsLoaderData,
		selection: ListDetailSelection,
		nextMessage: string | null,
		preserveDraft = false,
	) {
		setDeleteArmed(false)
		setShowSecretValue(false)
		if (!preserveDraft) {
			const freshEditor = selection.isCreating
				? createEditorStateFromNewSecretQuery(
						payload.packageOptions,
						currentHref,
					)
				: payload.selectedSecret
					? createEditorStateFromSecret(payload.selectedSecret)
					: createEmptyEditorState(payload.packageOptions)
			setEditorState(freshEditor)
			setSavedEditorState(freshEditor)
		}
		setMessage(
			nextMessage ??
				payload.approvalError ??
				(selection.selectedId && !payload.selectedSecret && !payload.approval
					? 'Secret not found.'
					: null),
		)
		setSubmittingApprovalAction(null)
		setSaveState('idle')
	}

	function formatAllowedPackageLabel(packageId: string) {
		const meta = packagesById.get(packageId)
		return meta
			? `${meta.kodyId} (${packageId})`
			: `Unknown package (${packageId})`
	}

	async function submitApproval(action: ApprovalAction) {
		if (!approval || submittingApprovalAction != null) return
		setSubmittingApprovalAction(action)
		setMessage(null)

		try {
			const currentUrl = new URL(getCurrentHref(), 'http://localhost')
			const selection = secretsRoute.getSelection(currentUrl.toString())
			const requestUrl = new URL(accountSecretsApiPath, currentUrl)
			requestUrl.search = currentUrl.search
			if (selection.selectedId) {
				requestUrl.searchParams.set('selected', selection.selectedId)
			}
			const payload = await secretsMutation.mutateAsync({
				url: `${requestUrl.pathname}${requestUrl.search}`,
				href: currentHref,
				body: { action },
			})
			if (router.state.location.href !== currentHref) return
			const isPackageApproval = Boolean(approval.requestedPackageId)
			applyPayload(
				payload,
				selection,
				isPackageApproval
					? null
					: action === 'approve'
						? 'Approved requested host.'
						: 'Rejected host approval request.',
			)
			if (isPackageApproval) {
				setCompletedPackageApproval(action)
				return
			}

			if (typeof window !== 'undefined' && window.location.search) {
				const nextHref = payload.selectedSecret
					? buildHrefWithUpdatedFilters(
							{},
							{
								pathname: buildAccountSecretPath({
									name: payload.selectedSecret.name,
									scope: payload.selectedSecret.scope,
									packageId: payload.selectedSecret.packageId,
								}),
							},
						)
					: buildHrefWithUpdatedFilters({}, { pathname: secretsBasePath })
				const nextUrl = new URL(nextHref, window.location.href)
				nextUrl.searchParams.delete('allowed-host')
				nextUrl.searchParams.delete('capability')
				nextUrl.searchParams.delete('package_id')
				nextUrl.searchParams.delete('package')
				nextUrl.searchParams.delete('names')
				nextUrl.searchParams.delete('name')
				// `navigate` is async (preload-then-commit); the commit render
				// consumes its preloaded data through `secretsData`.
				navigate(`${nextUrl.pathname}${nextUrl.search}`)
			}
		} catch (error) {
			setSubmittingApprovalAction(null)
			setMessage(
				error instanceof Error ? error.message : 'Unable to process approval.',
			)
		}
	}

	async function saveSecretChanges(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (saveState !== 'idle') return

		const form = event.currentTarget as HTMLFormElement
		const submittedEditorState = editorState

		setSaveState('saving')
		setMessage(null)

		try {
			const allowedHosts = normalizeAllowedHosts(
				collectRepeatedTextRows(form, 'allowed-hosts'),
			)
			const allowedPackages =
				submittedEditorState.scope === 'user'
					? [...submittedEditorState.allowedPackages].sort((left, right) =>
							left.localeCompare(right),
						)
					: []
			const payload = await secretsMutation.mutateAsync({
				url: accountSecretsApiPath,
				href: currentHref,
				body: {
					action: 'save',
					currentId: submittedEditorState.currentId,
					name: submittedEditorState.name,
					scope: submittedEditorState.scope,
					packageId:
						submittedEditorState.scope === 'package'
							? submittedEditorState.packageId
							: null,
					description: submittedEditorState.description,
					expiresAt: submittedEditorState.expiresAt || null,
					value: submittedEditorState.value,
					allowedHosts,
					allowedPackages,
				},
			})
			if (router.state.location.href !== currentHref) return

			const wasCreating = !submittedEditorState.currentId
			const nextSelection: ListDetailSelection = {
				selectedId: payload.selectedSecret?.id ?? null,
				isCreating: false,
			}
			applyPayload(
				payload,
				nextSelection,
				submittedEditorState.currentId ? 'Saved secret.' : 'Created secret.',
			)

			if (payload.selectedSecret) {
				navigate(
					buildSecretHref(
						payload.selectedSecret,
						wasCreating ? '' : getCurrentSearch(),
					),
				)
			}
		} catch (error) {
			setSaveState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to save secret.',
			)
		}
	}

	async function deleteSelectedSecret() {
		if (!editorState.currentId || saveState !== 'idle') return

		setSaveState('deleting')
		setMessage(null)

		try {
			const payload = await secretsMutation.mutateAsync({
				url: accountSecretsApiPath,
				href: currentHref,
				body: {
					action: 'delete',
					currentId: editorState.currentId,
				},
			})
			if (router.state.location.href !== currentHref) return

			navigate(buildBaseSecretsHref(getCurrentSearch()))
		} catch (error) {
			setSaveState('idle')
			setMessage(
				error instanceof Error ? error.message : 'Unable to delete secret.',
			)
		}
	}

	function updateAllowedHost(index: number, value: string) {
		setEditorState({
			...editorState,
			allowedHosts: editorState.allowedHosts.map((host, hostIndex) =>
				hostIndex === index ? value : host,
			),
		})
	}

	function addAllowedHost() {
		setEditorState({
			...editorState,
			allowedHosts: [...editorState.allowedHosts, ''],
		})
	}

	function removeAllowedHost(index: number) {
		const nextHosts = editorState.allowedHosts.filter(
			(_host, hostIndex) => hostIndex !== index,
		)
		setEditorState({
			...editorState,
			allowedHosts: nextHosts.length > 0 ? nextHosts : [''],
		})
	}

	function addAllowedPackage(packageId: string) {
		if (editorState.allowedPackages.includes(packageId)) return
		setEditorState({
			...editorState,
			allowedPackages: [...editorState.allowedPackages, packageId],
		})
	}

	function removeAllowedPackage(packageId: string) {
		setEditorState({
			...editorState,
			allowedPackages: editorState.allowedPackages.filter(
				(candidate) => candidate !== packageId,
			),
		})
	}

	const selection = secretsRoute.getSelection(currentHref)
	const status = 'ready'
	const isRefreshingForLocationChange = false
	const [lastPayload, setLastPayload] = useState(payload)
	const dataKey = getDataRefreshKey(currentHref)
	const [lastLocation, setLastLocation] = useState(dataKey)
	if (
		(lastPayload !== payload || lastLocation !== dataKey) &&
		saveState === 'idle' &&
		submittingApprovalAction === null
	) {
		setLastPayload(payload)
		setLastLocation(dataKey)
		applyPayload(
			payload,
			selection,
			null,
			lastLocation === dataKey &&
				JSON.stringify(editorState) !== JSON.stringify(savedEditorState),
		)
	}

	const filters = readFilterState(currentHref, packageOptions)
	const filteredSecrets = filterSecrets(secrets, filters, packagesById)
	const packageSelectOptions: Array<ComboboxOption> = packageOptions.map(
		(packageOption) => {
			const metadata = packagesById.get(packageOption.id)
			return {
				id: packageOption.id,
				label: metadata?.kodyId ?? packageOption.title,
				keywords: [packageOption.id],
			}
		},
	)
	const availableAllowedPackageOptions = packageSelectOptions.filter(
		(option) => !editorState.allowedPackages.includes(option.id),
	)
	const filterPackageOptions: Array<ComboboxOption> = [
		{ id: '', label: 'All packages' },
		...packageSelectOptions,
	]

	const activeSecretId = selection.selectedId ?? selectedSecret?.id ?? null
	const isMutating = saveState !== 'idle' || submittingApprovalAction != null
	const canCreatePackageSecrets = packageOptions.length > 0
	const showEditor = selection.isCreating || selectedSecret != null
	const secretValueAutofocusKey = getNewSecretValueAutofocusKey(currentHref)
	if (packageApprovalHref !== currentHref) {
		setPackageApprovalHref(currentHref)
		setCompletedPackageApproval(null)
	}

	if (isPackageApprovalHref(currentHref)) {
		const approvalError = payload.approvalError ?? null
		const pageApprovalError = approvalError
		const alreadyGranted =
			approval != null &&
			completedPackageApproval !== 'reject' &&
			isPackageSecretApprovalAlreadyGranted({
				secrets,
				approval,
			})
		return renderPackageSecretApprovalPage({
			currentHref,
			approval,
			approvalError: pageApprovalError,
			packagesById,
			completed: completedPackageApproval,
			alreadyGranted,
			submittingAction: submittingApprovalAction,
			message: message && message !== pageApprovalError ? message : null,
			onSubmit: (action) => {
				void submitApproval(action)
			},
		})
	}

	const alreadyAddedNotice = getAlreadyAddedNotice({
		href: currentHref,
		selectedSecret,
		approval,
		formatPackageId: formatAllowedPackageLabel,
	})
	const approvalCard =
		approval &&
		!isRefreshingForLocationChange &&
		!alreadyAddedNotice?.hostAlreadyAdded &&
		!alreadyAddedNotice?.packageAlreadyAdded
			? approval
			: null
	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Secrets"
				description="Passwords and tokens Kody can use for you."
				currentHref={currentHref}
				actions={
					<button
						type="button"
						disabled={isMutating}
						onClick={() => {
							if (isMutating) return
							navigate(buildNewSecretHref(getCurrentSearch()))
						}}
						css={primaryButtonCss}
					>
						New secret
					</button>
				}
			/>

			{approvalCard
				? renderSecretApprovalCard({
						approvalCard,
						packagesById,
						disabled: isMutating || isRefreshingForLocationChange,
						onSubmit: (action) => void submitApproval(action),
					})
				: null}
			{alreadyAddedNotice
				? renderAlreadyAddedNotice(alreadyAddedNotice.items)
				: null}

			{message ? (
				<AccountManagementMessage tone={'info'}>
					{message}
				</AccountManagementMessage>
			) : null}

			<RecordTable
				mode="expand"
				ariaLabel="Saved secrets"
				selectedId={activeSecretId}
				recordLoading={Boolean(
					selection.selectedId &&
					!selection.isCreating &&
					selectedSecret == null &&
					isRefreshingForLocationChange,
				)}
				countLabel={
					status === 'ready'
						? `${filteredSecrets.length} of ${secrets.length} shown`
						: undefined
				}
				emptyLabel={
					status !== 'ready'
						? 'Loading secrets…'
						: secrets.length === 0
							? 'No secrets yet. Create one to get started.'
							: 'No secrets match the current filters.'
				}
				toolbar={
					<>
						<RecordTableSearch
							label="Search secrets"
							placeholder="Search secrets"
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
							label="Filter secrets by scope"
							value={filters.scope}
							onChange={(value) => {
								const nextScope = value as SecretFilterScope
								updateFilters({ scope: nextScope })
							}}
						>
							<option value="all">All scopes</option>
							<option value="user">User</option>
							<option value="package">Package</option>
						</RecordTableSelect>
						{packageOptions.length > 0 ? (
							<span css={packageFilterSlotCss}>
								<Combobox
									key={`secret-package-filter:${filters.packageId}`}
									id="secret-package-filter"
									label="Filter secrets by package"
									hideLabel
									placeholder="All packages"
									value={filters.scope === 'user' ? '' : filters.packageId}
									disabled={filters.scope === 'user'}
									options={filterPackageOptions}
									onChange={(packageId) => {
										updateFilters({ packageId })
									}}
								/>
							</span>
						) : null}
					</>
				}
				columns={[
					{ key: 'name', label: 'Secret', primary: true },
					{ key: 'scope', label: 'Scope' },
					{ key: 'package', label: 'Package', drop: 2 },
					{ key: 'description', label: 'Description', drop: 1 },
					{ key: 'ttl', label: 'Expires' },
				]}
				createRow={
					selection.isCreating
						? {
								href: isMutating
									? undefined
									: buildNewSecretHref(getCurrentSearch()),
								label: 'New secret',
							}
						: undefined
				}
				rows={filteredSecrets.map((secret) => ({
					id: secret.id,
					// A save or delete is in flight; the expanded editor owns
					// the selection until it settles.
					href: isMutating
						? undefined
						: relocateAccountHref(
								buildSecretHref(secret, getCurrentSearch()),
								currentHref,
							),
					cells: {
						name: <span css={clampedCellCss}>{secret.name}</span>,
						scope: getScopeLabel(secret.scope),
						package: (
							<span css={clampedCellCss}>{secret.packageTitle || '—'}</span>
						),
						description: (
							<span css={clampedCellCss}>{secret.description || '—'}</span>
						),
						ttl: (
							<span css={recordStampCss}>
								{formatRelativeTtl(secret.ttlMs)}
							</span>
						),
					},
				}))}
				record={
					showEditor ? (
						<SecretEditor
							{...{
								isCreating: selection.isCreating,
								selectedSecret,
								editorState,
								setEditorState: (next) => {
									setEditorState(next)
								},
								packageOptions,
								packageSelectOptions,
								availableAllowedPackageOptions,
								packagesById,
								canCreatePackageSecrets,
								isMutating,
								saveState,
								showSecretValue,
								onToggleShowSecretValue: () => {
									setShowSecretValue(!showSecretValue)
								},
								secretValueAutofocusKey,
								deleteArmed,
								onDeleteArm: () => setDeleteArmed(true),
								onDeleteReset: () => setDeleteArmed(false),
								onSave: saveSecretChanges,
								onDelete: () => void deleteSelectedSecret(),
								updateAllowedHost,
								addAllowedHost,
								removeAllowedHost,
								addAllowedPackage,
								removeAllowedPackage,
							}}
						/>
					) : null
				}
			/>
		</AccountManagementShell>
	)
}

const primaryButtonCss = getPillButtonCss({ size: 'sm' })

const mutationResources = [
	'loadSecretsPage',
	'loadOnboarding',
	'loadAccountPage',
	'loadUsagePage',
] as const

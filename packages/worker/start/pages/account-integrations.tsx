/** @jsxImportSource @emotion/react */
import { pageQueryOrg } from '../page-query-scope.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { orgPageFilters, updateOrgPagePayload } from '../org-page-cache.ts'
import {
	type AccountIntegrationListItem,
	type AccountIntegrationsLoaderData,
	type AccountOauthAppListItem,
} from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { SiteLink } from '../components/site-link.tsx'
import { useUndoableAction } from '../components/use-undoable-action.ts'
import { UndoToast } from '../components/undo-toast.tsx'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { RecordTable, RecordTableSearch } from './record-table.tsx'
import { primaryLinkCss } from '#universal/styles/style-primitives.ts'
import {
	type IntegrationUsageDraft,
	type IntegrationsSnapshot,
	buildIntegrationHref,
	connectionLabel,
	deletedAppCopy,
	filterOauthApps,
	hostFromUrl,
	integrationListId,
	integrationsRoute,
	isBuiltInApp,
	oauthAppTitle,
	postIntegrationsMutation as postIntegration,
	readSearchFilter,
	resolveIntegrationsSelection,
} from './account-integrations-shared.ts'
import {
	renderIntegrationRecord,
	renderNamedProvider,
} from './account-integrations-detail.tsx'
import {
	renderApprovalCard,
	renderIntegrationsSetupSections,
	renderRecordNotFound,
} from './account-integrations-sections.tsx'

export function AccountIntegrationsPage({
	payload,
	currentHref,
}: {
	payload: AccountIntegrationsLoaderData
	currentHref: string
}) {
	const integrations = payload.integrations
	const apps = payload.apps ?? []
	const savedPackages = payload.savedPackages ?? []
	const platformCatalog = payload.platformCatalog ?? []
	const approval = payload.approval ?? null
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	function updatePayload(
		update: (
			data: AccountIntegrationsLoaderData,
		) => AccountIntegrationsLoaderData,
		href = currentHref,
	) {
		updateOrgPagePayload(
			queryClient,
			actorKey,
			'loadIntegrationsPage',
			href,
			update,
		)
	}
	const setIntegrations = (value: AccountIntegrationListItem[]) =>
		updatePayload((data) => ({ ...data, integrations: value }))
	const setApps = (value: AccountOauthAppListItem[]) =>
		updatePayload((data) => ({ ...data, apps: value }))
	const setApproval = (value: AccountIntegrationsLoaderData['approval']) =>
		updatePayload((data) => ({ ...data, approval: value }))
	const mutation = useMutation({
		mutationKey: ['integrations', actorKey, pageQueryOrg(currentHref)],
		mutationFn: async ({
			body,
			href,
			decision,
		}: {
			body: Record<string, unknown>
			href: string
			decision?: Promise<boolean>
			optimistic?: () => void
			rollback?: () => void
		}) => {
			if (decision && !(await decision)) return { undone: true as const }
			return postIntegration(body, href)
		},
		onMutate: async ({ href, optimistic }) => {
			await queryClient.cancelQueries(
				orgPageFilters(actorKey, 'loadIntegrationsPage', href),
			)
			optimistic?.()
		},
		onSuccess: (result, { rollback }) => {
			if (result && 'undone' in result) rollback?.()
		},
		onError: (_error, { rollback }) => rollback?.(),
		onSettled: (_data, _error, { href }) => {
			void queryClient.invalidateQueries(
				orgPageFilters(actorKey, 'loadIntegrationsPage', href),
			)
		},
	})
	function invalidatePages() {
		return queryClient.invalidateQueries(
			orgPageFilters(actorKey, 'loadIntegrationsPage', currentHref),
		)
	}
	const [usageDrafts, setUsageDrafts] = useState(
		new Map<string, IntegrationUsageDraft>(),
	)
	const [usageSavingName, setUsageSavingName] = useState<string | null>(null)
	const [approvalSubmitting, setApprovalSubmitting] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const postIntegrationsMutation = (body: Record<string, unknown>) =>
		mutation.mutateAsync({ body, href: currentHref })
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		router.navigate({ to: href, replace: true, resetScroll: false })
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [disconnectArmed, setDisconnectArmed] = useState<string | null>(null)
	const deleteAppConfirmation = {
		armed: deleteArmed,
		arm: () => setDeleteArmed(true),
		reset: () => setDeleteArmed(false),
	}
	const undoable = useUndoableAction()
	const [holdingOptimisticRemoval, setHoldingOptimisticRemoval] =
		useState(false)
	const mounted = useRef(false)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const live = useRef({ integrations, apps })
	useLayoutEffect(() => {
		live.current = { integrations, apps }
	}, [integrations, apps])

	function isHoldingOptimisticRemoval() {
		return Boolean(undoable.pending) || holdingOptimisticRemoval
	}

	function getDisconnectConfirmation(name: string) {
		return {
			armed: disconnectArmed === name,
			arm: () => setDisconnectArmed(name),
			reset: () => setDisconnectArmed(null),
		}
	}

	function snapshotList(): IntegrationsSnapshot {
		return {
			integrations,
			apps,
			href: getCurrentHref(),
		}
	}

	function restoreSnapshot(
		snapshot: IntegrationsSnapshot,
		names: Set<string>,
		deletedApp?: AccountOauthAppListItem,
	) {
		updatePayload(
			(data) => ({
				...data,
				integrations: [
					...data.integrations,
					...snapshot.integrations.filter(
						(entry) =>
							names.has(entry.name) &&
							!data.integrations.some((current) => current.name === entry.name),
					),
				],
				apps: snapshot.apps.reduce((current, original) => {
					const removed = original.connections.filter((connection) =>
						names.has(connection.name),
					)
					if (
						!removed.length &&
						(!deletedApp ||
							integrationListId(deletedApp) !== integrationListId(original))
					)
						return current
					const existing = current.find(
						(app) => integrationListId(app) === integrationListId(original),
					)
					if (!existing)
						return [
							...current,
							{
								...original,
								connections: removed,
								connectionCount: removed.length,
							},
						]
					return current.map((app) => {
						if (app !== existing) return app
						const connections = [
							...app.connections,
							...removed.filter(
								(row) =>
									!app.connections.some((item) => item.name === row.name),
							),
						]
						return { ...app, connections, connectionCount: connections.length }
					})
				}, data.apps ?? []),
			}),
			snapshot.href,
		)
		setMessage(null)
		if (
			mounted.current &&
			getCurrentHref() === currentHref &&
			integrationsRoute.isRoutePath(getCurrentHref()) &&
			getCurrentHref() !== snapshot.href
		) {
			navigate(snapshot.href)
		}
	}

	function listHref() {
		return `${relocateAccountHref('/account/integrations', currentHref)}${getCurrentSearch()}`
	}

	function currentSelectionMissing() {
		return Boolean(
			resolveIntegrationsSelection({
				href: getCurrentHref(),
				apps: live.current.apps,
				integrations: live.current.integrations,
			}).missingKind,
		)
	}

	function finishOptimisticRemoval() {
		setHoldingOptimisticRemoval(false)
		// The server-filtered "Connect with Kody" catalog hides built-ins whose
		// slug any connection holds, so every removal can re-offer one. List and
		// detail share one data latch key, so navigating between them never
		// refetches on its own; queue the reload before either branch.
		void invalidatePages()
		if (!mounted.current || getCurrentHref() !== currentHref) return
		if (currentSelectionMissing()) {
			navigate(listHref())
			return
		}
	}

	function removeConnectionLocally(name: string) {
		setIntegrations(integrations.filter((entry) => entry.name !== name))
		setApps(
			apps.flatMap((app) => {
				const connections = app.connections.filter(
					(connection) => connection.name !== name,
				)
				if (connections.length === app.connections.length) return [app]
				if (connections.length === 0) return []
				return [
					{
						...app,
						connections,
						connectionCount: connections.length,
					},
				]
			}),
		)
	}

	function removeAppLocally(app: AccountOauthAppListItem) {
		const names = new Set(app.connections.map((connection) => connection.name))
		setIntegrations(integrations.filter((entry) => !names.has(entry.name)))
		setApps(
			apps.filter(
				(entry) => integrationListId(entry) !== integrationListId(app),
			),
		)
	}

	function usageDraftFor(connection: AccountIntegrationListItem) {
		return (
			usageDrafts.get(connection.name) ?? {
				usageMode:
					connection.usageMode === 'packages'
						? ('packages' as const)
						: ('any' as const),
				allowedPackageIds: [...(connection.allowedPackageIds ?? [])],
			}
		)
	}

	function setUsageDraft(name: string, draft: IntegrationUsageDraft) {
		setUsageDrafts((current) => new Map(current).set(name, draft))
	}

	async function submitUsage(connection: AccountIntegrationListItem) {
		if (usageSavingName) return
		const draft = usageDraftFor(connection)
		setUsageSavingName(connection.name)
		try {
			await postIntegrationsMutation({
				action: 'set_usage',
				name: connection.name,
				usageMode: draft.usageMode,
				allowedPackageIds:
					draft.usageMode === 'packages' ? draft.allowedPackageIds : [],
			})
			setIntegrations(
				integrations.map((entry) =>
					entry.name === connection.name
						? {
								...entry,
								usageMode: draft.usageMode,
								allowedPackageIds:
									draft.usageMode === 'packages' ? draft.allowedPackageIds : [],
							}
						: entry,
				),
			)
			setUsageDrafts((current) => {
				const next = new Map(current)
				next.delete(connection.name)
				return next
			})
			void invalidatePages()
			setMessage(`Updated usage for ${connectionLabel(connection)}.`)
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update integration usage.',
			)
		} finally {
			setUsageSavingName(null)
		}
	}

	async function submitApproval() {
		if (!approval || approvalSubmitting) return
		setApprovalSubmitting(true)
		try {
			await postIntegrationsMutation({
				action: 'approve_package',
				name: approval.name,
				packageId: approval.packageId,
			})
			setIntegrations(
				integrations.map((entry) => {
					if (entry.name !== approval?.name) return entry
					if (entry.usageMode === 'any' || !entry.usageMode) return entry
					const allowed = new Set(entry.allowedPackageIds ?? [])
					allowed.add(approval.packageId)
					return {
						...entry,
						usageMode: 'packages',
						allowedPackageIds: Array.from(allowed),
					}
				}),
			)
			setApproval(approval ? { ...approval, alreadyGranted: true } : approval)
			void invalidatePages()
			if (getCurrentHref() !== currentHref) return
			navigate(relocateAccountHref('/account/integrations', currentHref))
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to approve that package.',
			)
		} finally {
			setApprovalSubmitting(false)
		}
	}

	async function startDisconnect(connection: {
		name: string
		accountLabel?: string | null
	}) {
		const snapshot = snapshotList()
		let decide!: (commit: boolean) => void
		const decision = new Promise<boolean>((resolve) => {
			decide = resolve
		})
		const write = mutation.mutateAsync({
			body: { action: 'disconnect_connection', name: connection.name },
			href: currentHref,
			decision,
			optimistic: () => removeConnectionLocally(connection.name),
			rollback: () => restoreSnapshot(snapshot, new Set([connection.name])),
		})
		setDisconnectArmed(null)
		setHoldingOptimisticRemoval(true)
		await undoable.start({
			message: `Disconnected ${connectionLabel(connection)}.`,
			onCommit: async () => {
				try {
					decide(true)
					await write
					finishOptimisticRemoval()
				} catch (error) {
					setHoldingOptimisticRemoval(false)
					setMessage(
						error instanceof Error
							? error.message
							: 'Unable to disconnect that account.',
					)
				}
			},
			onUndo: async () => {
				decide(false)
				await write
				setHoldingOptimisticRemoval(false)
			},
		})
	}

	async function startDeleteApp(app: AccountOauthAppListItem) {
		const snapshot = snapshotList()
		const title = oauthAppTitle(app)
		const connectionCount = app.connections.length
		let decide!: (commit: boolean) => void
		const decision = new Promise<boolean>((resolve) => {
			decide = resolve
		})
		const write = mutation.mutateAsync({
			body: { action: 'delete_oauth_app', appSlug: app.slug },
			href: currentHref,
			decision,
			optimistic: () => removeAppLocally(app),
			rollback: () =>
				restoreSnapshot(
					snapshot,
					new Set(app.connections.map((connection) => connection.name)),
					app,
				),
		})
		setDeleteArmed(false)
		setHoldingOptimisticRemoval(true)
		await undoable.start({
			message: deletedAppCopy(title, connectionCount),
			onCommit: async () => {
				try {
					decide(true)
					await write
					finishOptimisticRemoval()
				} catch (error) {
					setHoldingOptimisticRemoval(false)
					setMessage(
						error instanceof Error
							? error.message
							: 'Unable to delete that integration.',
					)
				}
			},
			onUndo: async () => {
				decide(false)
				await write
				setHoldingOptimisticRemoval(false)
			},
		})
	}

	function getCurrentHref() {
		return router.state.location.href
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function buildHrefWithUpdatedSearch(search: string) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		if (search) nextUrl.searchParams.set('q', search)
		else nextUrl.searchParams.delete('q')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function applyRotatedApp(rotatedApp: AccountOauthAppListItem) {
		void invalidatePages()
		setApps(
			apps.map((entry) =>
				entry.slug === rotatedApp.slug && !entry.platform ? rotatedApp : entry,
			),
		)
		setIntegrations(
			integrations.map((entry) =>
				entry.appSlug === rotatedApp.slug && !entry.platform
					? {
							...entry,
							clientId: rotatedApp.clientId,
							hasClientSecret: rotatedApp.hasClientSecret,
							appLabel: rotatedApp.label,
						}
					: entry,
			),
		)
	}

	const status = 'ready'

	const search = readSearchFilter(currentHref)
	const setupIntro =
		apps.length === 0
			? 'No integrations yet. Pick a service and copy its prompt into your agent — setup takes a few minutes.'
			: 'Add another service: copy a prompt into your agent.'
	const filteredApps = filterOauthApps(apps, search)
	const { selectedApp, highlightedConnectionName, missingKind } =
		resolveIntegrationsSelection({
			href: currentHref,
			apps,
			integrations,
		})
	const showIntegrationNotFound =
		missingKind === 'integration' &&
		status === 'ready' &&
		!isHoldingOptimisticRemoval()
	const showConnectionNotFound =
		missingKind === 'connection' &&
		status === 'ready' &&
		!isHoldingOptimisticRemoval()
	const highlightedConnection = highlightedConnectionName
		? (integrations.find(
				(connection) => connection.name === highlightedConnectionName,
			) ?? null)
		: null

	return (
		<AccountManagementShell busy={false}>
			<AccountPageHeader
				title="Integrations"
				description="Services you connect so Kody can use them."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone="info">
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' && approval
				? renderApprovalCard({
						currentHref,
						approval,
						submitting: approvalSubmitting,
						onApprove: () => void submitApproval(),
					})
				: null}

			{status === 'ready' ? (
				<>
					<RecordTable
						mode="expand"
						ariaLabel="Integrations"
						selectedId={selectedApp ? integrationListId(selectedApp) : null}
						recordLoading={Boolean(
							missingKind &&
							!showIntegrationNotFound &&
							!showConnectionNotFound,
						)}
						countLabel={`${filteredApps.length} of ${apps.length} integrations`}
						emptyLabel={
							apps.length === 0
								? 'No integrations yet.'
								: 'No integrations match the current filters.'
						}
						toolbar={
							<RecordTableSearch
								label="Search integrations"
								placeholder="Search names, hosts, or accounts"
								value={search}
								onInput={(value) => {
									return replaceLocation(buildHrefWithUpdatedSearch(value))
								}}
							/>
						}
						columns={[
							{ key: 'name', label: 'Integration', primary: true },
							{
								key: 'accounts',
								label: 'Accounts',
								align: 'end',
							},
						]}
						rows={filteredApps.map((app) => ({
							id: integrationListId(app),
							href: buildIntegrationHref(app, getCurrentSearch(), currentHref),
							cells: {
								name: renderNamedProvider({
									providerKey: app.provider || app.slug,
									label: oauthAppTitle(app),
									logoPath: app.platformLogoPath ?? app.logoPath,
									autoLogoPath: app.autoLogoPath,
									catalogLogoPath: app.catalogLogoPath,
									host: hostFromUrl(app.authorizeUrl ?? app.tokenUrl),
									builtIn: isBuiltInApp(app),
								}),
								accounts: String(app.connectionCount),
							},
						}))}
						record={
							selectedApp
								? renderIntegrationRecord({
										selectedApp,
										integrations,
										apps,
										savedPackages,
										highlightedConnectionName,
										highlightedConnection,
										currentHref,
										currentSearch: getCurrentSearch(),
										deleteAppConfirmation,
										getDisconnectConfirmation,
										startDeleteApp,
										startDisconnect,
										usageDraftFor,
										setUsageDraft,
										submitUsage,
										usageSavingName,
										onRotated: applyRotatedApp,
									})
								: showConnectionNotFound
									? renderRecordNotFound('connection')
									: showIntegrationNotFound
										? renderRecordNotFound('integration')
										: null
						}
					/>
				</>
			) : null}

			{status === 'ready'
				? renderIntegrationsSetupSections(setupIntro, platformCatalog)
				: null}

			<p css={{ margin: 0 }}>
				<SiteLink href="/account" css={primaryLinkCss}>
					Back to account
				</SiteLink>
			</p>
			{undoable.pending ? (
				<UndoToast
					message={undoable.pending.message}
					undoLabel={undoable.pending.undoLabel}
					onUndo={() => {
						void undoable.undo()
					}}
				/>
			) : null}
		</AccountManagementShell>
	)
}

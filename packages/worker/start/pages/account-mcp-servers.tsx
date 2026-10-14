/** @jsxImportSource @emotion/react */
import { createListDetailRoute } from '#client/list-detail-route.ts'
import {
	clearOnboardingMcpOAuthReturnCookie,
	closeOnboardingMcpOAuthPopupIfOpened,
} from '#client/mcp-oauth-popup.ts'
import {
	addMcpServer,
	reconnectMcpServer,
	refreshMcpServer,
	setMcpServerEnabled,
	setMcpServerUsage,
	deleteMcpServer,
	setMcpServerOAuthClient,
	removeMcpServerOAuthClient,
} from '#start/server/account-mutations'
import {
	getDangerPillCss,
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { orgPageFilters, updateOrgPagePayload } from '../org-page-cache.ts'
import { invalidatePageResources } from '../page-invalidation-cache.ts'
import { pageQueryOrg } from '../page-query-scope.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { renderMcpServerDetail } from './account-mcp-servers-detail.tsx'
import {
	renderAddMcpServerForm,
	renderOauthCallbackSection,
} from './account-mcp-servers-forms.tsx'
import {
	type AccountMcpServersPayload,
	type McpServerListItem,
	type McpServerUsageDraft,
	type MessageTone,
	filterServers,
	readAddServerPrefill,
	readOAuthResultFromHref,
	readSearchFilter,
	renderNamedServer,
	stateColor,
	stateLabel,
} from './account-mcp-servers-shared.tsx'
import {
	RecordDot,
	RecordTable,
	RecordTableSearch,
	recordBodyCss,
	recordCellClamp,
} from './record-table.tsx'

const clampedCellCss = recordCellClamp(26)

const mcpServersRoute = createListDetailRoute('/account/mcp-servers')

type McpServerChange =
	| { action: 'add'; name: string; url: string; bearerToken?: string }
	| {
			action: 'reconnect' | 'refresh' | 'delete' | 'remove-oauth-client'
			id: string
	  }
	| { action: 'set-enabled'; id: string; enabled: boolean }
	| {
			action: 'set-usage'
			id: string
			usageMode: 'any' | 'packages'
			allowedPackageIds: string[]
	  }
	| {
			action: 'set-oauth-client'
			id: string
			clientId: string
			clientSecret: string
	  }

export function AccountMcpServersPage({
	payload,
	currentHref,
}: {
	payload: AccountMcpServersPayload
	currentHref: string
}) {
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const currentScope = useRef<{ actorKey: string | null; href: string } | null>(
		null,
	)
	useEffect(() => {
		currentScope.current = { actorKey, href: currentHref }
		return () => {
			currentScope.current = null
		}
	}, [actorKey, currentHref])
	function isSubmitterCurrent() {
		return (
			currentScope.current !== null &&
			currentScope.current.actorKey === actorKey &&
			currentScope.current.href === currentHref
		)
	}
	const mutation = useMutation({
		mutationKey: ['mcpServers', actorKey, pageQueryOrg(currentHref)],
		mutationFn: async (input: {
			body: McpServerChange
			href: string
			actorKey: string | null
			failureMessage: string
		}) => {
			const orgSlug = pageQueryOrg(input.href) ?? undefined
			switch (input.body.action) {
				case 'add': {
					const { action: _action, ...fields } = input.body
					return addMcpServer({ data: { orgSlug, ...fields } })
				}
				case 'reconnect': {
					const { action: _action, ...fields } = input.body
					return reconnectMcpServer({ data: { orgSlug, ...fields } })
				}
				case 'refresh': {
					const { action: _action, ...fields } = input.body
					return refreshMcpServer({ data: { orgSlug, ...fields } })
				}
				case 'set-enabled': {
					const { action: _action, ...fields } = input.body
					return setMcpServerEnabled({ data: { orgSlug, ...fields } })
				}
				case 'set-usage': {
					const { action: _action, ...fields } = input.body
					return setMcpServerUsage({ data: { orgSlug, ...fields } })
				}
				case 'delete': {
					const { action: _action, ...fields } = input.body
					return deleteMcpServer({ data: { orgSlug, ...fields } })
				}
				case 'set-oauth-client': {
					const { action: _action, ...fields } = input.body
					return setMcpServerOAuthClient({ data: { orgSlug, ...fields } })
				}
				case 'remove-oauth-client': {
					const { action: _action, ...fields } = input.body
					return removeMcpServerOAuthClient({ data: { orgSlug, ...fields } })
				}
			}
		},
		onMutate: async ({ href, actorKey }) => {
			await queryClient.cancelQueries(
				orgPageFilters(actorKey, 'loadMcpServersPage', href),
			)
		},
		onSuccess: async (accepted, { href, actorKey }) => {
			await queryClient.cancelQueries(
				orgPageFilters(actorKey, 'loadMcpServersPage', href),
			)
			updateOrgPagePayload<AccountMcpServersPayload>(
				queryClient,
				actorKey,
				'loadMcpServersPage',
				href,
				() => accepted,
			)
		},
		onSettled: (_data, _error, { href, actorKey }) => {
			void invalidatePageResources(
				queryClient,
				actorKey,
				mutationResources,
				'active',
				href,
			)
		},
		onError: (_error, { href, actorKey }) => {
			void queryClient.invalidateQueries(
				orgPageFilters(actorKey, 'loadMcpServersPage', href),
			)
		},
	})
	const actionState = mutation.isPending ? 'busy' : 'idle'
	const servers = payload.servers
	const savedPackages = payload.savedPackages ?? []
	const [usageDrafts, setUsageDrafts] = useState(
		new Map<string, McpServerUsageDraft>(),
	)
	const [usageSavingId, setUsageSavingId] = useState<string | null>(null)
	const { oauthClientOrigin, oauthCallbackUrl, oauthClientMetadataUrl } =
		payload
	const creating = mcpServersRoute.getSelection(currentHref).isCreating
	const prefill = readAddServerPrefill(currentHref)
	const [addName, setAddName] = useState(creating ? prefill.name : '')
	const [addUrl, setAddUrl] = useState(creating ? prefill.url : '')
	useEffect(() => {
		if (creating) {
			setAddName(prefill.name)
			setAddUrl(prefill.url)
		}
	}, [creating, prefill.name, prefill.url])
	const [addBearerToken, setAddBearerToken] = useState('')
	const [message, setMessage] = useState<string | null>(
		readOAuthResultFromHref(currentHref)?.message ?? null,
	)
	const [messageTone, setMessageTone] = useState<MessageTone>(
		readOAuthResultFromHref(currentHref)?.tone ?? 'info',
	)
	const [deleteArmed, setDeleteArmed] = useState(false)
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({ to: href, resetScroll: false })
	const replaceLocation = (href: string) =>
		router.navigate({ to: href, replace: true, resetScroll: false })
	useEffect(() => {
		if (!closeOnboardingMcpOAuthPopupIfOpened())
			clearOnboardingMcpOAuthReturnCookie()
	}, [])

	const primaryButtonCss = getPillButtonCss({ size: 'sm' })
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
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

	function showMessage(nextMessage: string | null, tone: MessageTone = 'info') {
		setMessage(nextMessage)
		setMessageTone(tone)
	}

	function applyPayload(
		payload: AccountMcpServersPayload,
		preserveDrafts = false,
	) {
		setUsageDrafts(
			new Map(
				payload.servers.map((server) => {
					const draft = usageDrafts.get(server.id)
					const previous = servers.find((item) => item.id === server.id)
					const oldSaved = previous
						? {
								usageMode:
									previous.usageMode === 'packages' ? 'packages' : 'any',
								allowedPackageIds: [...(previous.allowedPackageIds ?? [])],
							}
						: null
					const next: McpServerUsageDraft = {
						usageMode: server.usageMode === 'packages' ? 'packages' : 'any',
						allowedPackageIds: [...(server.allowedPackageIds ?? [])],
					}
					return [
						server.id,
						preserveDrafts &&
						draft &&
						JSON.stringify(draft) !== JSON.stringify(oldSaved)
							? draft
							: next,
					]
				}),
			),
		)

		setUsageSavingId(null)
		setDeleteArmed(false)
	}

	async function postAction(input: {
		body: McpServerChange
		successMessage: (payload: AccountMcpServersPayload) => string | null
		failureMessage: string
		afterSuccess?: (payload: AccountMcpServersPayload) => void
	}) {
		if (actionState !== 'idle') return false
		showMessage(null)
		try {
			const payload = await mutation.mutateAsync({
				...input,
				href: currentHref,
				actorKey,
			})
			if (!isSubmitterCurrent() || router.state.location.href !== currentHref)
				return false
			applyPayload(payload)
			showMessage(input.successMessage(payload))
			input.afterSuccess?.(payload)
			return true
		} catch (error) {
			if (!isSubmitterCurrent()) return false
			setUsageSavingId(null)
			showMessage(
				error instanceof Error ? error.message : input.failureMessage,
				'error',
			)
			return false
		}
	}

	async function addServer(form: HTMLFormElement) {
		const formData = new FormData(form)
		const name = String(formData.get('name') ?? '').trim()
		setAddName(name)
		const url = String(formData.get('url') ?? '').trim()
		setAddUrl(url)
		const token = String(formData.get('bearerToken') ?? '')
		setAddBearerToken(token)
		if (!name) {
			showMessage('Server name is required.', 'error')
			return
		}
		if (!url) {
			showMessage('Server URL is required.', 'error')
			return
		}
		const bearerToken = token.trim()
		await postAction({
			body: {
				action: 'add',
				name,
				url,
				...(bearerToken ? { bearerToken } : {}),
			},
			successMessage: (payload) => {
				setAddName('')
				setAddUrl('')
				setAddBearerToken('')
				const added = payload.selectedServerId
					? payload.servers.find(
							(server) => server.id === payload.selectedServerId,
						)
					: null
				if (added?.authUrl && added.state === 'authenticating') {
					return `Added MCP server "${added.name}". It requires authorization before its tools become available.`
				}
				return added
					? `Added MCP server "${added.name}" (${added.toolCount} tool${added.toolCount === 1 ? '' : 's'}).`
					: 'Added MCP server.'
			},
			failureMessage: 'Unable to add MCP server.',
			afterSuccess: (payload) => {
				if (!payload.selectedServerId) return
				navigate(
					mcpServersRoute.buildDetailHref(
						payload.selectedServerId,
						getCurrentSearch(),
						currentHref,
					),
				)
			},
		})
	}

	function getUsageDraft(server: McpServerListItem): McpServerUsageDraft {
		return (
			usageDrafts.get(server.id) ?? {
				usageMode: server.usageMode === 'packages' ? 'packages' : 'any',
				allowedPackageIds: [...(server.allowedPackageIds ?? [])],
			}
		)
	}

	const status = 'ready'
	const [lastPayload, setLastPayload] = useState(payload)
	if (lastPayload !== payload && actionState === 'idle') {
		setLastPayload(payload)
		applyPayload(payload, true)
	}

	const isMutating = actionState !== 'idle'
	const selection = mcpServersRoute.getSelection(currentHref)
	const search = readSearchFilter(currentHref)
	const filteredServers = filterServers(servers, search)
	const server =
		servers.find((item) => item.id === selection.selectedId) ?? null
	const showServerNotFound =
		selection.selectedId != null && !server && status === 'ready'

	return (
		<AccountManagementShell currentHref={currentHref} busy={false}>
			<AccountPageHeader
				title="MCP servers"
				description="Connect remote MCP servers so their tools are available to Kody as kody.mcp capabilities. Use a bearer token for static Authorization, or complete OAuth when the server requires it."
				currentHref={currentHref}
				actions={
					<button
						type="button"
						disabled={isMutating}
						onClick={() => {
							if (isMutating) return
							setDeleteArmed(false)
							showMessage(null)
							navigate(
								mcpServersRoute.buildNewHref(getCurrentSearch(), currentHref),
							)
						}}
						css={primaryButtonCss}
					>
						Add server
					</button>
				}
			/>

			{oauthCallbackUrl
				? renderOauthCallbackSection({
						oauthClientOrigin,
						oauthCallbackUrl,
						oauthClientMetadataUrl,
					})
				: null}

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
					ariaLabel="Connected MCP servers"
					selectedId={selection.selectedId}
					recordLoading={Boolean(
						selection.selectedId &&
						!selection.isCreating &&
						!server &&
						!showServerNotFound,
					)}
					onNavigate={() => {
						setDeleteArmed(false)
						showMessage(null)
					}}
					countLabel={`${filteredServers.length} of ${servers.length} shown`}
					emptyLabel={
						servers.length === 0
							? 'No MCP servers yet. Add one to get started.'
							: 'No servers match the current filters.'
					}
					toolbar={
						<RecordTableSearch
							label="Search servers"
							placeholder="Search servers"
							value={
								new URL(currentHref, 'http://localhost').searchParams.get(
									'q',
								) ?? ''
							}
							onInput={(value) => {
								return replaceLocation(buildHrefWithUpdatedSearch(value))
							}}
						/>
					}
					columns={[
						{ key: 'name', label: 'Server', primary: true },
						{ key: 'state', label: 'State' },
						{ key: 'enabled', label: 'Enabled' },
						{ key: 'url', label: 'URL', drop: 1 },
						{ key: 'tools', label: 'Tools', align: 'end', drop: 2 },
					]}
					createRow={
						selection.isCreating
							? {
									href: isMutating
										? undefined
										: mcpServersRoute.buildNewHref(
												getCurrentSearch(),
												currentHref,
											),
									label: 'New server',
								}
							: undefined
					}
					rows={filteredServers.map((item) => ({
						id: item.id,
						// An add, toggle, or removal is in flight; the expanded
						// editor owns the selection until it settles.
						href: isMutating
							? undefined
							: mcpServersRoute.buildDetailHref(
									item.id,
									getCurrentSearch(),
									currentHref,
								),
						cells: {
							name: renderNamedServer(item),
							state: (
								<span css={{ color: stateColor(item) }}>
									{stateLabel(item)}
								</span>
							),
							enabled: (
								<RecordDot
									active={item.enabled}
									title={item.enabled ? 'Enabled' : 'Disabled'}
								/>
							),
							url: <span css={clampedCellCss}>{item.url}</span>,
							tools: item.connected ? String(item.toolCount) : '—',
						},
					}))}
					record={
						selection.isCreating ? (
							renderAddMcpServerForm({
								addName,
								addUrl,
								addBearerToken,
								isMutating,
								isBusy: actionState === 'busy',
								primaryButtonCss,
								onSubmit: (form) => {
									void addServer(form)
								},
								onNameInput: (value) => {
									setAddName(value)
								},
								onUrlInput: (value) => {
									setAddUrl(value)
								},
								onBearerTokenInput: (value) => {
									setAddBearerToken(value)
								},
							})
						) : server ? (
							renderMcpServerDetail({
								server,
								savedPackages,
								usageDraft: getUsageDraft(server),
								usageSaving: usageSavingId === server.id,
								isMutating,
								deleteArmed,
								onDeleteArm: () => setDeleteArmed(true),
								onDeleteReset: () => setDeleteArmed(false),
								primaryButtonCss,
								secondaryButtonCss,
								dangerButtonCss,
								onUsageDraftChange: (draft) => {
									setUsageDrafts((current) =>
										new Map(current).set(server.id, draft),
									)
								},
								onUsageSave: () => {
									const draft = getUsageDraft(server)
									setUsageSavingId(server.id)
									void postAction({
										body: {
											action: 'set-usage',
											id: server.id,
											usageMode: draft.usageMode,
											allowedPackageIds:
												draft.usageMode === 'packages'
													? draft.allowedPackageIds
													: [],
										},
										successMessage: () => 'Updated MCP server usage.',
										failureMessage: 'Unable to update MCP server usage.',
									})
								},
								onReconnect: () => {
									void postAction({
										body: { action: 'reconnect', id: server.id },
										successMessage: (payload) => {
											const reconnected = payload.servers.find(
												(item) => item.id === server.id,
											)
											return reconnected?.authUrl
												? 'Authorization needed. Open the new authorization link and approve access once more.'
												: 'Reconnected MCP server.'
										},
										failureMessage: 'Unable to reconnect MCP server.',
									})
								},
								onRefresh: () => {
									void postAction({
										body: { action: 'refresh', id: server.id },
										successMessage: () => 'Refreshed server tools.',
										failureMessage: 'Unable to refresh MCP server tools.',
									})
								},
								onToggleEnabled: () => {
									void postAction({
										body: {
											action: 'set-enabled',
											id: server.id,
											enabled: !server.enabled,
										},
										successMessage: () =>
											server.enabled
												? 'Disabled MCP server.'
												: 'Enabled MCP server.',
										failureMessage: 'Unable to update MCP server.',
									})
								},
								onOAuthClientSave: (client) =>
									postAction({
										body: {
											action: 'set-oauth-client',
											id: server.id,
											...client,
										},
										successMessage: (accepted) =>
											accepted.servers.find((item) => item.id === server.id)
												?.authUrl
												? 'Saved the OAuth client. Authorize the server to finish connecting.'
												: 'Saved the OAuth client.',
										failureMessage: 'Unable to save the OAuth client.',
									}),
								onOAuthClientRemove: () => {
									void postAction({
										body: { action: 'remove-oauth-client', id: server.id },
										successMessage: () => 'Removed the OAuth client.',
										failureMessage: 'Unable to remove the OAuth client.',
									})
								},
								onDelete: () => {
									void postAction({
										body: { action: 'delete', id: server.id },
										successMessage: () => 'Removed MCP server.',
										failureMessage: 'Unable to remove MCP server.',
										afterSuccess: () => {
											navigate(
												mcpServersRoute.buildListHref(
													getCurrentSearch(),
													currentHref,
												),
											)
										},
									})
								},
							})
						) : showServerNotFound ? (
							<div css={{ ...recordBodyCss, gap: spacing.sm }}>
								<h2
									css={{
										margin: 0,
										fontSize: typography.fontSize.lg,
										fontWeight: typography.fontWeight.semibold,
										color: colors.text,
									}}
								>
									Server not found
								</h2>
								<p css={{ margin: 0, color: colors.textMuted }}>
									This MCP server does not exist for this account or is
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

const mutationResources = [
	'loadOnboarding',
	'loadAccountPage',
	'loadUsagePage',
] as const

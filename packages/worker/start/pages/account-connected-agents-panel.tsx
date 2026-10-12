/** @jsxImportSource @emotion/react */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { orgPageFilters, updateOrgPagePayload } from '../org-page-cache.ts'
import { useState, type ReactNode } from 'react'
import { type CSSObject } from '@emotion/react'
import { SiteLink } from '../components/site-link.tsx'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { connectedAgentsApiPath } from '#client/routes/account-page-data.ts'
import {
	AccountManagementPanel,
	TimestampValue,
	accountActionsCss,
} from './account-management-components.tsx'
import { toast } from '#client/toast.ts'
import {
	accountConnectionsNewHref,
	isAccountConnectionAgent,
} from '#universal/account-connections.ts'
import {
	connectedAgentConnectionLabel,
	groupConnectedAgents,
} from '#universal/connected-mcp-agents.ts'
import {
	type AccountConnectedAgentListItem,
	type AccountConnectedAgentsLoaderData,
} from '#universal/loader-data.ts'
import { renderIcon } from '../components/icon.tsx'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	getDangerPillCss,
	getLogoWellCss,
	getSwapLabelCss,
} from '#universal/styles/style-primitives.ts'

export function useAccountConnectedAgents(
	initialPayload: AccountConnectedAgentsLoaderData,
	currentHref: string,
) {
	const agents = initialPayload.agents
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const [revokeArmed, setRevokeArmed] = useState<string | null>(null)
	const mutation = useMutation({
		mutationKey: [
			'connectedAgents',
			actorKey,
			orgSlugFromOrgOwnedPath(
				new URL(currentHref, 'http://localhost').pathname,
			),
		],
		mutationFn: async ({
			clientId,
			href,
		}: {
			clientId: string
			href: string
		}) => {
			const response = await fetch(connectedAgentsApiPath, {
				method: 'POST',
				referrer: orgAccountApiReferrer(href),
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ intent: 'revoke', clientId }),
			})
			const accepted = await readJson<
				AccountConnectedAgentsLoaderData & { error?: string }
			>(response)
			if (!response.ok || !accepted?.ok)
				throw new Error(accepted?.error ?? 'Unable to revoke this agent.')
		},
		onMutate: async ({ clientId, href }) => {
			const filters = orgPageFilters(actorKey, 'loadConnectionsPage', href)
			await queryClient.cancelQueries(filters)
			const removed = queryClient
				.getQueriesData<{ payload: AccountConnectedAgentsLoaderData }>(filters)
				.map(([key, data]) => ({
					key,
					agent: data?.payload.agents.find(
						(agent) => agent.clientId === clientId,
					),
				}))
			updateOrgPagePayload<AccountConnectedAgentsLoaderData>(
				queryClient,
				actorKey,
				'loadConnectionsPage',
				href,
				(payload) => ({
					...payload,
					agents: payload.agents.filter((agent) => agent.clientId !== clientId),
				}),
			)
			return removed
		},
		onSuccess: () => {
			toast.success('Agent disconnected.')
		},
		onError: (error, _variables, removed) => {
			for (const { key, agent } of removed ?? [])
				if (agent)
					queryClient.setQueryData<{
						payload: AccountConnectedAgentsLoaderData
					}>(key, (data) =>
						data &&
						!data.payload.agents.some(
							(item) => item.clientId === agent.clientId,
						)
							? {
									...data,
									payload: {
										...data.payload,
										agents: [...data.payload.agents, agent],
									},
								}
							: data,
					)
			toast.error(error.message)
		},
		onSettled: (_data, _error, { href }) => {
			const orgSlug = orgSlugFromOrgOwnedPath(
				new URL(href, 'http://localhost').pathname,
			)
			if (
				queryClient.isMutating({
					mutationKey: ['connectedAgents', actorKey, orgSlug],
				}) === 1
			)
				void queryClient.invalidateQueries(
					orgPageFilters(actorKey, 'loadConnectionsPage', href),
				)
		},
	})
	function revokeAgent(clientId: string) {
		setRevokeArmed(null)
		mutation.mutate({ clientId, href: currentHref })
	}

	return {
		revokeAgent,
		/** Current list after optimistic revokes — Add connection marks use this. */
		listAgents() {
			return agents
		},
		/** `actions` renders under the list (the Connections list page puts Add connection there). */
		render(options?: { actions?: ReactNode }) {
			const groups = groupConnectedAgents(agents)
			return (
				<AccountManagementPanel
					title="Connected agents"
					description="AI hosts that have authorized against this Kody account. Same-named hosts are grouped. Labels are best-effort from the host name or redirect. Already connected does not block reconnect — use View connect steps for a second login, new machine, or reinstall."
					ariaLabel="Connected agents"
				>
					{groups.length > 0 ? (
						<ul
							css={{
								listStyle: 'none',
								padding: 0,
								margin: 0,
								display: 'grid',
								gap: spacing.md,
							}}
						>
							{groups.map((group) => (
								<li
									key={group.label}
									data-testid="connected-agent-group"
									data-agent-label={group.label}
									css={groupItemCss}
								>
									<details css={groupDetailsCss}>
										<summary css={groupSummaryCss}>
											<ConnectedAgentMark icon={group.icon} />
											<span
												css={{
													fontWeight: typography.fontWeight.medium,
													color: colors.text,
												}}
											>
												{group.label}
											</span>
											{group.members.length > 1 ? (
												<>
													<span
														aria-hidden="true"
														css={{
															color: colors.textMuted,
															fontSize: typography.fontSize.sm,
														}}
													>
														({group.members.length})
													</span>
													<span className="visually-hidden">
														{`${group.members.length} connections`}
													</span>
												</>
											) : null}
											<span
												css={{
													color: colors.textMuted,
													fontSize: typography.fontSize.sm,
												}}
											>
												Last used{' '}
												<TimestampValue
													value={group.lastUsedAt}
													fallback="unknown"
												/>
												{' · '}
												Connected{' '}
												<TimestampValue
													value={group.connectedAt}
													fallback="at an unknown time"
												/>
											</span>
										</summary>
										<ul
											css={{
												listStyle: 'none',
												padding: 0,
												margin: 0,
												display: 'grid',
												gap: spacing.sm,
											}}
										>
											{group.members.map((agent) => {
												const revokeIsArmed = revokeArmed === agent.clientId
												const connectionLabel = connectedAgentConnectionLabel(
													agent.clientId,
												)
												const revokeName =
													group.members.length > 1
														? `${agent.label} (${connectionLabel})`
														: agent.label
												return (
													<li
														key={agent.clientId}
														data-testid="connected-agent-connection"
														data-client-id={agent.clientId}
														css={connectionRowCss}
													>
														<span css={{ display: 'grid', gap: spacing.xs }}>
															<code
																title={agent.clientId}
																css={{
																	color: colors.text,
																	fontSize: typography.fontSize.sm,
																	overflowWrap: 'anywhere',
																}}
															>
																{connectionLabel}
															</code>
															<span
																css={{
																	color: colors.textMuted,
																	fontSize: typography.fontSize.sm,
																}}
															>
																Last used{' '}
																<TimestampValue
																	value={agent.lastUsedAt}
																	fallback="unknown"
																/>
															</span>
															<span
																css={{
																	color: colors.textMuted,
																	fontSize: typography.fontSize.sm,
																}}
															>
																Connected{' '}
																<TimestampValue
																	value={agent.connectedAt}
																	fallback="at an unknown time"
																/>
															</span>
														</span>
														<button
															type="button"
															aria-label={
																revokeIsArmed
																	? `Confirm revoke ${revokeName}`
																	: `Revoke ${revokeName}`
															}
															css={dangerButtonCss}
															onBlur={() => setRevokeArmed(null)}
															onClick={() => {
																if (revokeIsArmed) {
																	setRevokeArmed(null)
																	void revokeAgent(agent.clientId)
																} else setRevokeArmed(agent.clientId)
															}}
														>
															<span
																data-swap-label
																data-active={revokeIsArmed ? undefined : true}
																aria-hidden={revokeIsArmed ? 'true' : undefined}
															>
																Revoke
															</span>
															<span
																data-swap-label
																data-active={revokeIsArmed ? true : undefined}
																aria-hidden={revokeIsArmed ? undefined : 'true'}
															>
																Confirm revoke
															</span>
														</button>
													</li>
												)
											})}
										</ul>
									</details>
									{isAccountConnectionAgent(group.kind) ? (
										<SiteLink
											href={accountConnectionsNewHref(group.kind, currentHref)}
											data-testid="connected-agent-view-steps"
											data-agent-kind={group.kind}
											data-prevent-scroll-reset=""
											css={viewStepsLinkCss}
										>
											View connect steps
										</SiteLink>
									) : null}
								</li>
							))}
						</ul>
					) : (
						<p css={{ color: colors.textMuted, margin: 0 }}>
							No agents have authorized yet. Connect one from onboarding or your
							MCP host.
						</p>
					)}
					{options?.actions ? (
						<div css={accountActionsCss}>{options.actions}</div>
					) : null}
				</AccountManagementPanel>
			)
		},
	}
}

function ConnectedAgentMark({ icon }: { icon: string | null }) {
	if (!icon) {
		return (
			<span
				aria-hidden="true"
				data-testid="connected-agent-mark-fallback"
				css={{
					display: 'grid',
					placeItems: 'center',
					flex: 'none',
					width: '1.75rem',
					height: '1.75rem',
					color: colors.textMuted,
				}}
			>
				{renderIcon('dots-horizontal', { size: '18' })}
			</span>
		)
	}
	return (
		<span
			aria-hidden="true"
			css={getLogoWellCss({ size: '1.75rem', radius: radius.md })}
		>
			<img
				src={`/images/icons/${icon}.svg`}
				alt=""
				width={20}
				height={20}
				css={{
					display: 'block',
					width: '1.15rem',
					height: '1.15rem',
					objectFit: 'contain',
				}}
			/>
		</span>
	)
}

const groupItemCss: CSSObject = {
	display: 'grid',
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	alignItems: 'start',
	gap: spacing.sm,
	columnGap: spacing.md,
}

const groupDetailsCss: CSSObject = {
	minWidth: 0,
	'&[open] > summary': { marginBottom: spacing.sm },
}

const groupSummaryCss: CSSObject = {
	display: 'flex',
	alignItems: 'center',
	gap: spacing.sm,
	cursor: 'pointer',
	flexWrap: 'wrap' as const,
}

const viewStepsLinkCss: CSSObject = {
	color: colors.primaryText,
	fontSize: typography.fontSize.sm,
	fontWeight: typography.fontWeight.medium,
	textDecoration: 'none',
	whiteSpace: 'nowrap' as const,
	paddingBlock: '0.2rem',
	'&:hover': {
		color: colors.text,
	},
}

const connectionRowCss: CSSObject = {
	display: 'grid',
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	alignItems: 'start',
	gap: spacing.md,
	paddingInlineStart: spacing.lg,
}

const dangerButtonCss = [getDangerPillCss({ size: 'sm' }), getSwapLabelCss()]

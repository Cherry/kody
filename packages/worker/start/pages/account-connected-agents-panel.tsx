/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
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
) {
	const [agents, setAgents] = useState<Array<AccountConnectedAgentListItem>>(
		initialPayload.agents,
	)
	const [pendingRevokes] = useState(() => new Set<string>())
	/**
	 * After a revoke commits, ignore those grant IDs in later payloads so a
	 * prefetched / in-flight GET cannot restore the row or the Add connection
	 * Connected mark. Keyed by grant (not clientId) so a same-client reconnect
	 * with a new grant still appears. Cleared only on revoke failure or reload.
	 */
	const [revokedGrantIds] = useState(() => new Set<string>())
	const invalidatePages = usePageInvalidation(mutationResources)
	const [revokeArmed, setRevokeArmed] = useState<string | null>(null)
	const [lastPayload, setLastPayload] = useState(initialPayload)
	if (lastPayload !== initialPayload) {
		setLastPayload(initialPayload)
		setAgents(visibleAgents(initialPayload.agents))
	}

	function agentSurvivesRevokeFilter(agent: AccountConnectedAgentListItem) {
		if (pendingRevokes.has(agent.clientId)) return false
		if (revokedGrantIds.size === 0) return true
		// Hide only when every listed grant was tombstoned. A new grant under
		// the same clientId means a fresh reconnect and must stay visible.
		return agent.grantIds.some((grantId) => !revokedGrantIds.has(grantId))
	}

	function visibleAgents(next: Array<AccountConnectedAgentListItem>) {
		if (pendingRevokes.size === 0 && revokedGrantIds.size === 0) return next
		return next.filter(agentSurvivesRevokeFilter)
	}

	function applyPayload(payload: AccountConnectedAgentsLoaderData) {
		setAgents(visibleAgents(payload.agents))
	}

	async function revokeAgent(clientId: string) {
		const removed = agents.find((agent) => agent.clientId === clientId)
		if (!removed) return

		setAgents(agents.filter((agent) => agent.clientId !== clientId))
		setRevokeArmed(null)
		pendingRevokes.add(clientId)
		try {
			const response = await fetch(connectedAgentsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ intent: 'revoke', clientId }),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				AccountConnectedAgentsLoaderData & { error?: string }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to revoke this agent.')
			}
			pendingRevokes.delete(clientId)
			for (const grantId of removed.grantIds) {
				revokedGrantIds.add(grantId)
			}
			// Keep the optimistic list. Replacing from this response can put
			// back a sibling that already committed if that POST listed earlier.
			toast.success('Agent disconnected.')
			void invalidatePages()
		} catch (error) {
			pendingRevokes.delete(clientId)
			// Do not clear revokedGrantIds: this attempt never added tombstones
			// (only success does), and deleted IDs could wipe an earlier revoke.
			setAgents((current) =>
				current.some((agent) => agent.clientId === clientId)
					? current
					: [...current, removed],
			)
			toast.error(
				error instanceof Error ? error.message : 'Unable to revoke this agent.',
			)
		} finally {
			pendingRevokes.delete(clientId)
		}
	}

	return {
		applyPayload,
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
											href={accountConnectionsNewHref(group.kind)}
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

const mutationResources = [
	'loadConnectionsPage',
	'loadOnboarding',
	'loadAccountPage',
] as const

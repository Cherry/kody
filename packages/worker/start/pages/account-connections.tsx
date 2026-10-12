/** @jsxImportSource @emotion/react */
import { type CSSObject } from '@emotion/react'
import { SiteLink } from '../components/site-link.tsx'
import { useAccountConnectedAgents } from './account-connected-agents-panel.tsx'
import {
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	accountActionsCss,
} from './account-management-components.tsx'
import { CopyCard } from './onboarding-mcp-client-cards.tsx'
import {
	AgentPickerGrid,
	AgentSurfaceInstructions,
} from './onboarding-mcp-client-tabs.tsx'
import {
	type AccountConnectionsView,
	accountConnectionAgentIds,
	accountConnectionsNewHref,
	parseAccountConnectionsPathname,
} from '#universal/account-connections.ts'
import { docHref } from '#universal/docs-nav.ts'
import { type AccountConnectedAgentsLoaderData } from '#universal/loader-data.ts'
import { onboardingSecondAgentGreyedPresentation } from '#universal/onboarding-agent-ecosystems.ts'
import {
	type McpClientKind,
	onboardingAgentLabel,
} from '#universal/onboarding-mcp-clients.ts'
import { routes } from '#universal/routes.ts'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'

const connectYourAgentDocHref = docHref('connect-your-agent')

function readView(href: string): AccountConnectionsView | null {
	return parseAccountConnectionsPathname(
		new URL(href, 'http://localhost').pathname,
	)
}

/**
 * `/account/connections` — the durable home for inbound MCP hosts. The
 * connected list is the same panel Overview used to host. Add connection
 * is its own page (`/new`): the full client wall from onboarding Step 1
 * with no phone/desktop split and nothing folded under Not listed, not a
 * nested child of the list. `/new/:agent` shows that host's install
 * steps. Sign-in providers stay on Overview; outbound MCP servers stay on
 * MCP servers.
 */
export function AccountConnectionsPage({
	payload,
	currentHref,
}: {
	payload: AccountConnectedAgentsLoaderData
	currentHref: string
}) {
	const connectedAgents = useAccountConnectedAgents(payload)
	return (
		<AccountManagementShell>
			<AccountPageHeader
				title="Connections"
				description="The agents connected to this Kody account, and how to connect another."
				currentHref={currentHref}
			/>
			{renderReadyView({
				view: readView(currentHref),
				connectedAgents,
				mcpServerUrl: payload.mcpServerUrl,
			})}
		</AccountManagementShell>
	)
}

function renderBackToConnections() {
	return (
		<SiteLink
			href={routes.accountConnections.href()}
			data-testid="account-connections-back"
			css={backLinkCss}
		>
			← back to connections
		</SiteLink>
	)
}

function renderReadyView(input: {
	view: AccountConnectionsView | null
	connectedAgents: ReturnType<typeof useAccountConnectedAgents>
	mcpServerUrl: string
}) {
	if (input.view === null) {
		return (
			<>
				{renderBackToConnections()}
				{renderUnknownAgent()}
			</>
		)
	}
	switch (input.view.kind) {
		case 'list':
			return (
				<>
					{input.connectedAgents.render({
						actions: (
							<SiteLink
								href={accountConnectionsNewHref(null)}
								data-testid="account-connections-add"
								css={primaryButtonCss}
							>
								Add connection
							</SiteLink>
						),
					})}
					{renderMcpUrlPanel({ mcpServerUrl: input.mcpServerUrl })}
					{renderAdvancedPanel()}
				</>
			)
		case 'new':
			return (
				<>
					{renderBackToConnections()}
					{input.view.agent === null
						? renderAgentGrid({
								mcpServerUrl: input.mcpServerUrl,
								connectedAgents: input.connectedAgents.listAgents(),
							})
						: renderAgentInstructions({
								agent: input.view.agent,
								mcpServerUrl: input.mcpServerUrl,
							})}
				</>
			)
		default: {
			const _exhaustive: never = input.view
			return _exhaustive
		}
	}
}

function renderAdvancedPanel() {
	return (
		<AccountManagementPanel
			title="Advanced"
			description="Optional tools for hosts that cannot finish dynamic OAuth on their own. This is not the list of agents already connected to your account."
		>
			<div css={accountActionsCss}>
				<SiteLink
					href={routes.accountMcpOauthClients.href()}
					css={compactGhostButtonCss}
				>
					MCP OAuth clients
				</SiteLink>
			</div>
		</AccountManagementPanel>
	)
}

function renderVerifyNote() {
	return (
		<p
			data-testid="account-connections-verify-note"
			css={{ color: colors.textMuted, margin: 0 }}
		>
			Verify your email to get this deployment&apos;s MCP URL. MCP access stays
			locked until the account email is verified.{' '}
			<SiteLink href={routes.pendingVerification.href()}>
				Verification page
			</SiteLink>
		</p>
	)
}

function renderMcpUrlPanel(input: { mcpServerUrl: string }) {
	return (
		<AccountManagementPanel
			title="MCP URL"
			description="Every host reaches the same account through one MCP URL. Add connection walks through a specific agent; any other agent that speaks MCP can paste this URL and approve the Kody OAuth window."
			ariaLabel="MCP URL"
		>
			{input.mcpServerUrl ? (
				<CopyCard
					label="MCP URL"
					value={input.mcpServerUrl}
					copyLabel="Copy MCP URL"
					variant="pill"
				/>
			) : (
				renderVerifyNote()
			)}
			<div css={accountActionsCss}>
				<SiteLink href={connectYourAgentDocHref} css={compactGhostButtonCss}>
					Connect your agent docs
				</SiteLink>
			</div>
		</AccountManagementPanel>
	)
}

function renderAgentGrid(input: {
	mcpServerUrl: string
	connectedAgents: AccountConnectedAgentsLoaderData['agents']
}) {
	const connectedMark = onboardingSecondAgentGreyedPresentation(
		input.connectedAgents,
	)
	return (
		<AccountManagementPanel
			title="Add connection"
			description="Pick the agent you want to connect — including ones already connected, when you need the steps again for a second login, new machine, or reinstall. Every agent Kody knows how to connect is listed here, on every device; the next step shows that host's install path."
			ariaLabel="Add connection"
		>
			{input.mcpServerUrl ? (
				<div
					data-testid="account-connections-agent-grid"
					css={{ display: 'grid', gap: spacing.lg }}
				>
					<span className="visually-hidden" id="account-connections-add-title">
						Agents you can connect
					</span>
					<AgentPickerGrid
						ids={accountConnectionAgentIds.map((id) => ({
							id,
							viewport: 'both' as const,
						}))}
						labelledBy="account-connections-add-title"
						agentHref={(agent) => accountConnectionsNewHref(agent)}
						greyedAgents={connectedMark.greyedAgents}
						greyedReasons={connectedMark.greyedReasons}
						greyedTitles={connectedMark.greyedTitles}
					/>
					<div css={{ display: 'grid', gap: spacing.sm }}>
						<p css={{ color: colors.textMuted, margin: 0 }}>
							Using something else? Any agent that speaks MCP connects with this
							URL. Approve the Kody OAuth window when the host opens it.
						</p>
						<CopyCard
							label="MCP URL"
							value={input.mcpServerUrl}
							copyLabel="Copy MCP URL"
						/>
					</div>
				</div>
			) : (
				renderVerifyNote()
			)}
		</AccountManagementPanel>
	)
}

function renderAgentInstructions(input: {
	agent: McpClientKind
	mcpServerUrl: string
}) {
	const label = onboardingAgentLabel(input.agent)
	return (
		<AccountManagementPanel
			title={`Connect ${label}`}
			description="Follow the steps for this host, then approve the Kody OAuth window when it opens. The new connection appears on the connections list once the host authorizes."
			ariaLabel={`Connect ${label}`}
		>
			<div css={accountActionsCss}>
				<SiteLink
					href={accountConnectionsNewHref(null)}
					data-testid="account-connections-change-agent"
					css={compactGhostButtonCss}
				>
					Change agent
				</SiteLink>
			</div>
			{input.mcpServerUrl ? (
				<div
					data-testid="account-connections-agent-instructions"
					data-agent={input.agent}
					css={{ display: 'grid', gap: spacing.lg }}
				>
					<AgentSurfaceInstructions
						agent={input.agent}
						mcpServerUrl={input.mcpServerUrl}
					/>
				</div>
			) : (
				renderVerifyNote()
			)}
		</AccountManagementPanel>
	)
}

function renderUnknownAgent() {
	return (
		<AccountManagementPanel
			title="Unknown agent"
			description="That agent is not one Kody knows how to connect. Pick one from the list, or use the MCP URL with any host that speaks MCP."
		>
			<div css={accountActionsCss}>
				<SiteLink
					href={accountConnectionsNewHref(null)}
					css={compactGhostButtonCss}
				>
					Choose an agent
				</SiteLink>
			</div>
		</AccountManagementPanel>
	)
}

const compactGhostButtonCss = getGhostButtonCss({ size: 'sm' })

const primaryButtonCss: CSSObject = {
	...getPillButtonCss({ size: 'sm' }),
	textDecoration: 'none',
	width: 'fit-content',
}

const backLinkCss: CSSObject = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: spacing.xs,
	width: 'fit-content',
	fontSize: typography.fontSize.sm,
	fontWeight: typography.fontWeight.medium,
	color: colors.primaryText,
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
	},
}

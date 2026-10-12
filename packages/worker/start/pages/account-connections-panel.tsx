/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { pageResourceKey } from '../page-mutation-cache.ts'
import { type loadAccountPage } from '#start/server/account-page'
import { SiteLink } from '../components/site-link.tsx'
import { getOauthLoginErrorMessage } from '#universal/oauth-login-errors.ts'
import { ProviderIcon } from '../components/provider-icons.tsx'
import { startSocialSignIn } from '../social-sign-in.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { type AccountConnectionsLoaderData } from '#universal/loader-data.ts'
import { kodyDiscordInviteUrl } from '#universal/community-links.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	getDangerPillCss,
	getGhostButtonCss,
	mutedLinkCss,
} from '#universal/styles/style-primitives.ts'
import { AccountManagementPanel } from './account-management-components.tsx'

const connectionsApiPath = '/account/connections.json'

const providerLabels: Record<string, string> = {
	github: 'GitHub',
	google: 'Google',
	x: 'X',
	discord: 'Discord',
}

/** One-shot message from the OAuth callback redirect query params. */
function readConnectionCallbackMessage(href: string) {
	const searchParams = new URL(href, 'http://localhost').searchParams
	const linkedProvider = searchParams.get('oauthLinked')
	if (linkedProvider) {
		return {
			text: `${providerLabels[linkedProvider] ?? linkedProvider} connected.`,
			tone: 'info' as const,
		}
	}
	const errorMessage = getOauthLoginErrorMessage(searchParams.get('oauthError'))
	if (errorMessage) {
		return { text: errorMessage, tone: 'error' as const }
	}
	return null
}

function discordMemberRoleMessage(status: string) {
	switch (status) {
		case 'assigned':
			return 'Kody Discord roles updated.'
		case 'not-in-guild':
			return 'Join the Kody Discord first, then sync your roles.'
		case 'not-configured':
		case 'skipped':
			return 'Discord role sync is not configured.'
		case 'forbidden':
			return 'Kody could not update your Discord roles. Please try again later.'
		default:
			return 'Unable to sync Discord roles.'
	}
}

export function useAccountConnections(
	initial: AccountConnectionsLoaderData,
	href: string,
) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const [connecting, setConnectionsBusy] = useState(false)
	const {
		connections,
		canDisconnect,
		hasUsablePassword,
		availableProviders,
		canSyncDiscordRoles,
	} = initial
	function publish(payload: AccountConnectionsLoaderData) {
		queryClient.setQueriesData<Awaited<ReturnType<typeof loadAccountPage>>>(
			{ queryKey: pageResourceKey(actorKey, 'loadAccountPage') },
			(data) =>
				data
					? {
							...data,
							payloads: { ...data.payloads, accountConnections: payload },
						}
					: data,
		)
	}
	const mutation = useMutation({
		mutationKey: ['accountConnections', actorKey],
		mutationFn: async (
			input:
				| { intent: 'disconnect'; provider: string }
				| { intent: 'sync-discord-role' },
		) => {
			const response = await fetch(connectionsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(input),
			})
			const payload = await readJson<
				AccountConnectionsLoaderData & {
					error?: string
					discordMemberRole?: { status: string }
				}
			>(response)
			if (!response.ok || !payload?.ok)
				throw new Error(
					payload?.error || 'Unable to update connected accounts.',
				)
			return payload
		},
		onMutate: () =>
			queryClient.cancelQueries({
				queryKey: pageResourceKey(actorKey, 'loadAccountPage'),
			}),
		onSuccess: publish,
		onSettled: () => {
			void invalidatePages()
		},
	})
	const connectionsBusy = connecting || mutation.isPending

	const [connectionsMessage, setConnectionsMessage] = useState<{
		text: string
		tone: 'error' | 'info'
	} | null>(readConnectionCallbackMessage(href))

	async function connectProvider(providerId: string) {
		setConnectionsBusy(true)
		setConnectionsMessage(null)
		try {
			const errorMessage = await startSocialSignIn(providerId, null)
			if (errorMessage) {
				setConnectionsMessage({ text: errorMessage, tone: 'error' })
				setConnectionsBusy(false)
			}
			// On success the browser is navigating to the provider; keep the
			// busy state until the page unloads.
		} catch {
			setConnectionsMessage({
				text: 'Network error. Please try again.',
				tone: 'error',
			})
			setConnectionsBusy(false)
		}
	}

	function syncDiscordMemberRole() {
		setConnectionsMessage(null)
		mutation.mutate(
			{ intent: 'sync-discord-role' },
			{
				onSuccess: (payload) => {
					const status = payload.discordMemberRole?.status ?? 'error'
					setConnectionsMessage({
						text: discordMemberRoleMessage(status),
						tone:
							status === 'assigned' || status === 'not-in-guild'
								? 'info'
								: 'error',
					})
				},
				onError: (error) =>
					setConnectionsMessage({ text: error.message, tone: 'error' }),
			},
		)
	}
	function disconnectProvider(providerId: string) {
		setConnectionsMessage(null)
		mutation.mutate(
			{ intent: 'disconnect', provider: providerId },
			{
				onSuccess: () =>
					setConnectionsMessage({
						text: `${providerLabels[providerId] ?? providerId} disconnected.`,
						tone: 'info',
					}),
				onError: (error) =>
					setConnectionsMessage({ text: error.message, tone: 'error' }),
			},
		)
	}

	return {
		get hasUsablePassword() {
			return hasUsablePassword
		},
		markHasUsablePassword() {
			publish({ ...initial, hasUsablePassword: true, canDisconnect: true })
		},
		setMessage(next: { text: string; tone: 'error' | 'info' } | null) {
			setConnectionsMessage(next ?? connectionsMessage)
		},
		render() {
			return renderPanel()
		},
	}

	function renderPanel() {
		const onConnectProvider = (providerId: string) =>
			void connectProvider(providerId)
		const onDisconnectProvider = (providerId: string) =>
			void disconnectProvider(providerId)
		const onSyncDiscordMemberRole = () => void syncDiscordMemberRole()
		return (
			<AccountManagementPanel
				title="Connected accounts"
				description="Sign in with GitHub, Google, X, or Discord by connecting them to this account. Connections with the same verified email also link automatically at sign-in."
				ariaLabel="Connected accounts"
			>
				{connectionsMessage ? (
					<p
						role="status"
						css={{
							color:
								connectionsMessage.tone === 'error'
									? colors.error
									: colors.text,
							margin: 0,
						}}
					>
						{connectionsMessage.text}
					</p>
				) : null}
				<div css={{ display: 'grid', gap: spacing.md }}>
					{connections.length > 0 ? (
						<ul
							css={{
								listStyle: 'none',
								padding: 0,
								margin: 0,
								display: 'grid',
								gap: spacing.md,
							}}
						>
							{connections.map((connection) => (
								<li
									key={connection.provider}
									css={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										gap: spacing.md,
										flexWrap: 'wrap',
									}}
								>
									<span css={{ display: 'grid', gap: spacing.xs }}>
										<span
											css={{
												display: 'inline-flex',
												alignItems: 'center',
												gap: spacing.sm,
												fontWeight: typography.fontWeight.medium,
												color: colors.text,
											}}
										>
											<ProviderIcon providerId={connection.provider} />
											{connection.label}
										</span>
										<span
											css={{
												color: colors.textMuted,
												fontSize: typography.fontSize.sm,
											}}
										>
											{connection.displayName
												? `Connected as ${connection.displayName}`
												: 'Connected'}
										</span>
										{connection.provider === 'discord' ? (
											<SiteLink
												href={kodyDiscordInviteUrl}
												target="_blank"
												rel="noreferrer"
												css={mutedLinkCss}
											>
												Join the Kody Discord
											</SiteLink>
										) : null}
									</span>
									<span
										css={{
											display: 'flex',
											gap: spacing.sm,
											flexWrap: 'wrap',
										}}
									>
										{connection.provider === 'discord' &&
										canSyncDiscordRoles ? (
											<button
												type="button"
												disabled={connectionsBusy}
												css={compactGhostButtonCss}
												onClick={onSyncDiscordMemberRole}
											>
												Sync Discord roles
											</button>
										) : null}
										<button
											type="button"
											disabled={connectionsBusy || !canDisconnect}
											title={
												canDisconnect
													? undefined
													: 'This connection is your only way to sign in. Set a password or register a passkey first.'
											}
											css={dangerButtonCss}
											onClick={() => onDisconnectProvider(connection.provider)}
										>
											Disconnect
										</button>
									</span>
								</li>
							))}
						</ul>
					) : (
						<p css={{ color: colors.textMuted, margin: 0 }}>
							No accounts connected yet.
						</p>
					)}
					{availableProviders.length > 0 ? (
						<div
							css={{
								display: 'flex',
								gap: spacing.md,
								flexWrap: 'wrap',
							}}
						>
							{availableProviders.map((provider) => (
								<button
									key={provider.id}
									type="button"
									disabled={connectionsBusy}
									css={compactGhostButtonCss}
									onClick={() => onConnectProvider(provider.id)}
								>
									<ProviderIcon providerId={provider.id} />
									Connect {provider.label}
								</button>
							))}
						</div>
					) : null}
				</div>
			</AccountManagementPanel>
		)
	}
}

const compactGhostButtonCss = getGhostButtonCss({ size: 'sm' })

const dangerButtonCss = getDangerPillCss({ size: 'sm' })

const mutationResources = [
	'loadAccountPage',
	'loadDiscord',
	'loadOnboarding',
] as const

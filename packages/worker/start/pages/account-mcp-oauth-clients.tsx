/** @jsxImportSource @emotion/react */
import { usePageResponseMutation } from '../use-page-response-mutation.ts'
import { useState, type FormEvent } from 'react'
import { type CSSObject } from '@emotion/react'
import { writeClipboardText } from '#client/clipboard.ts'
import { passwordManagerIgnoreProps } from '#client/password-manager-ignore.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	accountInputCss,
	TimestampValue,
} from './account-management-components.tsx'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	cardCss,
	cardTitleCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getAccentCalloutCss,
	getDangerPillCss,
	getGhostButtonCss,
	getPillButtonCss,
	layoutMaxWidths,
} from '#universal/styles/style-primitives.ts'
import { type AccountMcpOauthClientsLoaderData } from '#universal/loader-data.ts'

const clientsApiPath = '/account/mcp-oauth-clients.json'

type CreatedClient = AccountMcpOauthClientsLoaderData['clients'][number] & {
	clientSecret: string
}

export function AccountMcpOauthClientsPage({
	payload,
	currentHref,
}: {
	payload: AccountMcpOauthClientsLoaderData
	currentHref: string
}) {
	const [actionStatus, setActionStatus] = useState<'idle' | 'busy'>('idle')
	const clients = payload.clients
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'error' | 'info'>('info')
	const [labelDraft, setLabelDraft] = useState('Open WebUI')
	const [redirectUrisDraft, setRedirectUrisDraft] = useState('')
	const [createdClient, setCreatedClient] = useState<CreatedClient | null>(null)
	const mutation = usePageResponseMutation<
		AccountMcpOauthClientsLoaderData & { createdClient?: CreatedClient }
	>('loadMcpOauthClientsPage', clientsApiPath, {
		dependencies: mutationResources,
		dependencyScope: 'actor',
		merge: (page, accepted) => ({
			...page,
			payload: { ok: accepted.ok, clients: accepted.clients },
		}),
	})
	const [revokeArmed, setRevokeArmed] = useState<string | null>(null)
	const primaryButtonCss = getPillButtonCss({ size: 'sm' })

	const ghostButtonCss = getGhostButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })

	async function handleCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setActionStatus('busy')
		setMessage(null)
		try {
			const payload = await mutation.submit({
				intent: 'create',
				label: labelDraft,
				redirectUris: redirectUrisDraft,
			})
			if (!payload.createdClient)
				throw new Error('Unable to create the OAuth client.')
			setCreatedClient(payload.createdClient)
			setMessage(
				'Copy the client secret now. Kody does not store it after this page.',
			)
			setMessageTone('info')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to create the OAuth client.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	async function handleRevoke(id: string) {
		setActionStatus('busy')
		setMessage(null)
		try {
			await mutation.submit({ intent: 'revoke', id })
			if (createdClient?.id === id) setCreatedClient(null)
			setRevokeArmed(null)
			setMessage('OAuth client revoked.')
			setMessageTone('info')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to revoke the OAuth client.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	async function copyValue(value: string, label: string) {
		try {
			await writeClipboardText(value)
			setMessage(`Copied ${label}.`)
			setMessageTone('info')
		} catch {
			setMessage(`Unable to copy ${label}.`)
			setMessageTone('error')
		}
	}

	const status = 'ready'

	const isBusy = actionStatus === 'busy'

	return (
		<AccountManagementShell maxWidth={layoutMaxWidths.content} busy={false}>
			<AccountPageHeader
				title="MCP OAuth clients"
				description="Pre-register a confidential client when a host cannot finish dynamic OAuth registration. Most hosts do not need this."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' ? (
				<>
					<section css={cardCss}>
						<h2 css={cardTitleCss}>Create a client</h2>
						<p css={descriptionCss}>
							Use this for hosts such as Open WebUI that ask for a static Client
							ID and Client Secret. Prefer OAuth 2.1 dynamic registration when
							the host can open the authorize window.
						</p>
						<p css={descriptionCss}>
							Open WebUI: MCP URL{' '}
							<code css={inlineCodeCss}>https://kody.codes/mcp</code>, auth
							OAuth 2.1 (Static), OAuth Server URL{' '}
							<code css={inlineCodeCss}>https://kody.codes</code>. The redirect
							URI is{' '}
							<code css={inlineCodeCss}>
								{'{your-open-webui}/oauth/clients/mcp:{connection-id}/callback'}
							</code>
							. If the connection id is <code css={inlineCodeCss}>kody</code>,
							that path ends with{' '}
							<code css={inlineCodeCss}>mcp:kody/callback</code>.
						</p>
						<form
							method="post"
							onSubmit={handleCreate}
							css={{
								display: 'grid',
								gap: spacing.md,
							}}
						>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Label</span>
								<input
									data-field-ring
									type="text"
									value={labelDraft}
									maxLength={80}
									disabled={isBusy}
									onInput={(event) => {
										setLabelDraft(
											(event.currentTarget as HTMLInputElement).value,
										)
									}}
									css={accountInputCss}
								/>
							</label>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Redirect URIs</span>
								<textarea
									data-field-ring
									rows={3}
									value={redirectUrisDraft}
									disabled={isBusy}
									placeholder="https://your-open-webui/oauth/clients/mcp:kody/callback"
									onInput={(event) => {
										setRedirectUrisDraft(
											(event.currentTarget as HTMLTextAreaElement).value,
										)
									}}
									css={{
										...accountInputCss,
										minHeight: '5.5rem',
										resize: 'vertical',
									}}
								/>
							</label>
							<div>
								<button type="submit" disabled={isBusy} css={primaryButtonCss}>
									{isBusy ? 'Working…' : 'Create client'}
								</button>
							</div>
						</form>
					</section>

					{createdClient ? (
						<section
							css={{
								...cardCss,
								...getAccentCalloutCss(),
							}}
							aria-label="New client credentials"
						>
							<h2 css={cardTitleCss}>New client credentials</h2>
							<p css={descriptionCss}>
								Paste these into the host, then store the secret yourself. Kody
								cannot show it again.
							</p>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Client ID</span>
								<div
									css={{
										display: 'flex',
										gap: spacing.sm,
										alignItems: 'center',
										flexWrap: 'wrap',
									}}
								>
									<input
										data-field-ring
										type="text"
										value={createdClient.clientId}
										readOnly
										{...passwordManagerIgnoreProps}
										css={{
											...accountInputCss,
											flex: '1 1 16rem',
										}}
									/>
									<button
										type="button"
										onClick={() => {
											void copyValue(createdClient!.clientId, 'client ID')
										}}
										css={ghostButtonCss}
									>
										Copy
									</button>
								</div>
							</label>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Client secret</span>
								<div
									css={{
										display: 'flex',
										gap: spacing.sm,
										alignItems: 'center',
										flexWrap: 'wrap',
									}}
								>
									<input
										data-field-ring
										type="password"
										value={createdClient.clientSecret}
										readOnly
										{...passwordManagerIgnoreProps}
										css={{
											...accountInputCss,
											flex: '1 1 16rem',
										}}
									/>
									<button
										type="button"
										onClick={() => {
											void copyValue(
												createdClient!.clientSecret,
												'client secret',
											)
										}}
										css={ghostButtonCss}
									>
										Copy
									</button>
								</div>
							</label>
						</section>
					) : null}

					{clients.length === 0 ? (
						<section css={cardCss}>
							<h2 css={cardTitleCss}>No clients yet</h2>
							<p css={descriptionCss}>
								Created clients appear here. Revoking a client immediately stops
								it from exchanging tokens.
							</p>
						</section>
					) : (
						<section css={cardCss} aria-label="MCP OAuth clients">
							<h2 css={cardTitleCss}>Your clients</h2>
							<ul
								css={{
									listStyle: 'none',
									padding: 0,
									margin: 0,
									display: 'grid',
									gap: spacing.md,
								}}
							>
								{clients.map((client) => (
									<li
										key={client.id}
										css={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'flex-start',
											gap: spacing.md,
											flexWrap: 'wrap',
											paddingBottom: spacing.md,
											borderBottom: `1px solid ${colors.border}`,
										}}
									>
										<div
											css={{
												display: 'grid',
												gap: spacing.xs,
												flex: '1 1 16rem',
												minWidth: 0,
											}}
										>
											<strong css={{ color: colors.text }}>
												{client.label}
											</strong>
											<code
												css={{
													...inlineCodeCss,
													overflowWrap: 'anywhere',
												}}
											>
												{client.clientId}
											</code>
											<p
												css={{
													...descriptionCss,
													margin: 0,
												}}
											>
												{client.redirectUris.join(' ')}
											</p>
											<p
												css={{
													margin: 0,
													color: colors.textMuted,
													fontSize: typography.fontSize.sm,
												}}
											>
												{client.revokedAt ? (
													<>
														Revoked <TimestampValue value={client.revokedAt} />
													</>
												) : (
													'Active'
												)}
												{' · '}
												Created <TimestampValue value={client.createdAt} />
											</p>
										</div>
										{client.revokedAt ? null : (
											<button
												type="button"
												disabled={isBusy}
												css={dangerButtonCss}
												onBlur={() => setRevokeArmed(null)}
												onClick={() => {
													if (revokeArmed === client.id) {
														setRevokeArmed(null)
														void handleRevoke(client.id)
													} else setRevokeArmed(client.id)
												}}
											>
												{revokeArmed === client.id ? 'Revoke now' : 'Revoke'}
											</button>
										)}
									</li>
								))}
							</ul>
						</section>
					)}
				</>
			) : null}
		</AccountManagementShell>
	)
}

const inlineCodeCss: CSSObject = {
	fontFamily: typography.fontFamilyMono,
	fontSize: typography.fontSize.sm,
	color: colors.text,
}

const mutationResources = ['loadConnectionsPage'] as const

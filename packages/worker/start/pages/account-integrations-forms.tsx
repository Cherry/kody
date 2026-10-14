/** @jsxImportSource @emotion/react */
import { useMatchedPageScope } from '../use-matched-page-scope.ts'
import { useMutation } from '@tanstack/react-query'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import {
	type AccountIntegrationListItem,
	type AccountOauthAppListItem,
} from '#universal/loader-data.ts'
import { useState } from 'react'
import { type CSSObject } from '@emotion/react'
import { SiteLink } from '../components/site-link.tsx'
import { passwordManagerIgnoreProps } from '#client/password-manager-ignore.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	AccountManagementMessage,
	accountInputCss,
} from './account-management-components.tsx'
import {
	addAccountAnchorId,
	nextSuggestedConnectionName,
	resolveAddAccountConnectionName,
} from '#client/routes/integration-provider-catalog.ts'
import { buildConnectOauthHref } from '#universal/oauth-connect.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getPillButtonCss,
	primaryLinkCss,
} from '#universal/styles/style-primitives.ts'
import {
	type IntegrationUsageDraft,
	accountIntegrationsApiPath,
	dangerButtonCss,
	integrationListId,
} from './account-integrations-shared.ts'

const addAccountLinkCss: CSSObject = {
	...primaryLinkCss,
	justifySelf: 'start',
	width: 'fit-content',
}

export function AddAccountForm(props: {
	slug: string
	/** Built-in row: also send `platform=` so the built-in lane wins over a same-slug personal app while it is discoverable. */
	platform?: boolean
	existingNames: ReadonlyArray<string>
	open: boolean
	openHref: string
}) {
	const [nameError, setNameError] = useState<string | null>(null)
	const [editedName, setEditedName] = useState<string | null>(null)
	const [boundSlug, setBoundSlug] = useState(props.slug)

	function connectHref(connectionName: string) {
		return buildConnectOauthHref({
			name: connectionName,
			appSlug: props.slug,
			platformSlug: props.platform ? props.slug : undefined,
		})
	}

	if (props.slug !== boundSlug) {
		setBoundSlug(props.slug)
		setEditedName(null)
		setNameError(null)
	}
	const suggested = nextSuggestedConnectionName(props.slug, props.existingNames)
	const name = editedName ?? suggested
	if (!props.open) {
		return (
			<SiteLink
				href={props.openHref}
				data-testid="add-account-open"
				data-prevent-scroll-reset
				css={addAccountLinkCss}
			>
				Add another account
			</SiteLink>
		)
	}
	return (
		<form
			method="post"
			id={addAccountAnchorId}
			data-testid="add-account-form"
			onSubmit={(event) => {
				event.preventDefault()
				const resolved = resolveAddAccountConnectionName({
					name,
					suggested,
					existingNames: props.existingNames,
				})
				if (!resolved.ok) {
					setNameError(resolved.error)
					return
				}
				setNameError(null)
				window.location.assign(connectHref(resolved.name))
			}}
			css={{
				display: 'grid',
				gap: spacing.sm,
				justifyItems: 'start',
				scrollMarginTop: '5.5rem',
			}}
		>
			<label css={fieldCss}>
				<span css={fieldLabelCss}>Connection name</span>
				<input
					type="text"
					name="connectionName"
					data-field-ring
					required
					value={name}
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby={nameError ? 'add-account-name-error' : undefined}
					{...passwordManagerIgnoreProps}
					onInput={(event) => {
						setEditedName(event.currentTarget.value)
						setNameError(null)
					}}
					css={accountInputCss}
				/>
				{nameError ? (
					<p
						id="add-account-name-error"
						role="alert"
						data-testid="add-account-name-error"
						css={{
							...descriptionCss,
							color: colors.error,
						}}
					>
						{nameError}
					</p>
				) : null}
			</label>
			<button
				type="submit"
				css={{
					...getPillButtonCss({ size: 'sm' }),
					display: 'inline-flex',
				}}
			>
				Connect
			</button>
		</form>
	)
}

export function ConnectionUsageForm(props: {
	connection: AccountIntegrationListItem
	savedPackages: ReadonlyArray<{ id: string; kodyId: string }>
	draft: IntegrationUsageDraft
	saving: boolean
	onDraftChange: (draft: IntegrationUsageDraft) => void
	onSave: () => void
}) {
	const { connection, savedPackages, draft, saving, onDraftChange, onSave } =
		props
	return (
		<section
			data-testid="integration-usage"
			css={{ display: 'grid', gap: spacing.xs }}
		>
			<p
				css={{
					...fieldLabelCss,
					margin: 0,
				}}
			>
				Usage
			</p>
			<label
				css={{
					display: 'flex',
					gap: spacing.xs,
					alignItems: 'flex-start',
					color: colors.text,
					fontSize: typography.fontSize.sm,
				}}
			>
				<input
					type="radio"
					name={`usage-mode-${connection.name}`}
					checked={draft.usageMode === 'any'}
					disabled={saving}
					onChange={() =>
						onDraftChange({
							usageMode: 'any',
							allowedPackageIds: [],
						})
					}
				/>
				<span>Any context (execute and every package)</span>
			</label>
			<label
				css={{
					display: 'flex',
					gap: spacing.xs,
					alignItems: 'flex-start',
					color: colors.text,
					fontSize: typography.fontSize.sm,
				}}
			>
				<input
					type="radio"
					name={`usage-mode-${connection.name}`}
					checked={draft.usageMode === 'packages'}
					disabled={saving}
					onChange={() =>
						onDraftChange({
							usageMode: 'packages',
							allowedPackageIds: draft.allowedPackageIds,
						})
					}
				/>
				<span>Specific packages only</span>
			</label>
			{draft.usageMode === 'packages' ? (
				savedPackages.length === 0 ? (
					<p css={{ ...descriptionCss, margin: 0 }}>
						Save a package first, then approve it here. Execute cannot use this
						connection while it is limited to specific packages.
					</p>
				) : (
					<div css={{ display: 'grid', gap: spacing.xs }}>
						{savedPackages.map((savedPackage) => {
							const checked = draft.allowedPackageIds.includes(savedPackage.id)
							return (
								<label
									key={savedPackage.id}
									css={{
										display: 'flex',
										gap: spacing.xs,
										alignItems: 'center',
										fontSize: typography.fontSize.sm,
									}}
								>
									<input
										type="checkbox"
										checked={checked}
										disabled={saving}
										onChange={() =>
											onDraftChange({
												usageMode: 'packages',
												allowedPackageIds: checked
													? draft.allowedPackageIds.filter(
															(id) => id !== savedPackage.id,
														)
													: [...draft.allowedPackageIds, savedPackage.id],
											})
										}
									/>
									<span>{savedPackage.kodyId}</span>
								</label>
							)
						})}
					</div>
				)
			) : null}
			<button
				type="button"
				data-testid="save-integration-usage"
				disabled={saving}
				onClick={onSave}
				css={getPillButtonCss({ size: 'sm' })}
			>
				{saving ? 'Saving…' : 'Save usage'}
			</button>
		</section>
	)
}

export function RotateCredentialsForm(props: {
	app: AccountOauthAppListItem
	onRotated: (app: AccountOauthAppListItem) => void
}) {
	const href = useMatchedPageScope().pageLocation.href
	const captureSubmitter = useSubmitterScope()
	const invalidate = usePageInvalidation([
		'loadIntegrationsPage',
		'loadConnectionsPage',
	])
	const mutation = useMutation({
		mutationFn: async (input: {
			href: string
			body: Record<string, unknown>
		}) => {
			const isCurrentSubmitter = captureSubmitter()
			const response = await fetch(accountIntegrationsApiPath, {
				method: 'POST',
				referrer: orgAccountApiReferrer(input.href),
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(input.body),
			})
			if (response.status === 401) {
				if (isCurrentSubmitter()) window.location.assign('/login')
				throw new Error('Please sign in again.')
			}
			const payload = await readJson<{
				ok: boolean
				error?: string
				app?: AccountOauthAppListItem
			}>(response)
			if (!response.ok || !payload?.ok || !payload.app)
				throw new Error(payload?.error || 'Unable to rotate credentials.')
			return payload.app
		},
		onMutate: () => invalidate,
		onSettled: (_data, _error, _input, reconcile) => reconcile?.(),
		gcTime: 0,
	})
	const [clientId, setClientId] = useState(props.app.clientId)
	const [clientSecret, setClientSecret] = useState('')
	const [confirmed, setConfirmed] = useState(false)
	const [status, setStatus] = useState<'idle' | 'saving'>('idle')
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'error' | 'info'>('info')
	const [boundAppId, setBoundAppId] = useState(integrationListId(props.app))

	function reset(app: AccountOauthAppListItem) {
		setClientId(app.clientId)
		setClientSecret('')
		setConfirmed(false)
		setStatus('idle')
		setMessage(null)
		setMessageTone('info')
		setBoundAppId(integrationListId(app))
	}

	async function submit(app: AccountOauthAppListItem) {
		if (status === 'saving') return
		const nextClientId = clientId.trim()
		const nextClientSecret = clientSecret.trim()
		if (!confirmed) {
			setMessage(
				'Confirm that every connection on this app should use the new credentials.',
			)
			setMessageTone('error')
			return
		}
		if (!nextClientId && !nextClientSecret) {
			setMessage('Provide a new client id and/or client secret.')
			setMessageTone('error')
			return
		}
		if (nextClientId === app.clientId && !nextClientSecret) {
			setMessage('Enter a new client id or client secret to rotate.')
			setMessageTone('error')
			return
		}
		setStatus('saving')
		setMessage(null)
		const isCurrentSubmitter = captureSubmitter()
		try {
			const rotatedApp = await mutation.mutateAsync({
				href,
				body: {
					action: 'rotate_oauth_app_credentials',
					appSlug: app.slug,
					...(nextClientId ? { clientId: nextClientId } : {}),
					...(nextClientSecret ? { clientSecret: nextClientSecret } : {}),
					confirm: true,
				},
			})
			if (!isCurrentSubmitter()) return
			reset(rotatedApp)
			setMessage('Rotated shared credentials for this integration.')
			setMessageTone('info')
			props.onRotated(rotatedApp)
		} catch (error) {
			if (!isCurrentSubmitter()) return
			setStatus('idle')
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to rotate credentials.',
			)
			setMessageTone('error')
		}
	}

	if (integrationListId(props.app) !== boundAppId) {
		reset(props.app)
	}
	const app = props.app
	return (
		<>
			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			<form
				method="post"
				onSubmit={(event) => {
					event.preventDefault()
					void submit(app)
				}}
				css={{
					display: 'grid',
					gap: spacing.md,
					marginTop: spacing.sm,
				}}
			>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Client ID (optional to keep current)</span>
					<input
						type="text"
						data-field-ring
						name="oauthAppClientId"
						value={clientId}
						{...passwordManagerIgnoreProps}
						onInput={(event) => {
							setClientId(event.currentTarget.value)
						}}
						css={accountInputCss}
					/>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>New client secret</span>
					<input
						type="password"
						data-field-ring
						name="oauthAppClientSecret"
						value={clientSecret}
						{...passwordManagerIgnoreProps}
						onInput={(event) => {
							setClientSecret(event.currentTarget.value)
						}}
						css={accountInputCss}
					/>
				</label>
				<label
					css={{
						display: 'flex',
						alignItems: 'flex-start',
						gap: spacing.sm,
						color: colors.text,
						fontSize: typography.fontSize.sm,
					}}
				>
					<input
						type="checkbox"
						checked={confirmed}
						onChange={(event) => {
							setConfirmed(event.currentTarget.checked)
						}}
					/>
					<span>
						I understand this updates credentials for
						{app.connections.length === 0
							? ' this integration'
							: app.connections.length === 1
								? ' 1 connection on this integration'
								: ` all ${app.connections.length} connections on this integration`}
						.
					</span>
				</label>
				<div>
					<button
						type="submit"
						disabled={status === 'saving' || !confirmed}
						css={dangerButtonCss}
					>
						{status === 'saving' ? 'Rotating...' : 'Rotate credentials'}
					</button>
				</div>
			</form>
		</>
	)
}

/** @jsxImportSource @emotion/react */
import { type QueryKey } from '@tanstack/react-query'
import { usePageResponseMutation } from '../use-page-response-mutation.ts'
import { useHydrated } from '../components/use-hydrated.ts'
import { toDataURL } from 'qrcode'
import { useState, type FormEvent } from 'react'
import { SiteLink } from '../components/site-link.tsx'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	accountInputCss,
} from './account-management-components.tsx'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	cardCss,
	cardTitleCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getDangerPillCss,
	getGhostButtonCss,
	getPillButtonCss,
	layoutMaxWidths,
	primaryLinkCss,
} from '#universal/styles/style-primitives.ts'

export type AccountTwoFactorPayload = {
	ok: true
	enabled: boolean
}

type TwoFactorSetup = {
	otpUri: string
	secret: string
	qrCodeDataUrl: string | null
}

const twoFactorApiPath = '/account/two-factor.json'

export function AccountTwoFactorPage({
	queryKey,
	payload,
	currentHref,
}: {
	queryKey: QueryKey
	payload: AccountTwoFactorPayload
	currentHref: string
}) {
	const [actionStatus, setActionStatus] = useState<'idle' | 'busy'>('idle')
	const enabled = payload.enabled
	const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
	const [confirmCode, setConfirmCode] = useState('')
	const [disableCode, setDisableCode] = useState('')
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'error' | 'info'>('info')
	const mutation = usePageResponseMutation<{
		ok?: boolean
		enabled?: boolean
		otpUri?: string
		secret?: string
		error?: string
	}>(queryKey, 'loadAccountSecurity', twoFactorApiPath, {
		dependencies: ['loadAccountPage'],
		refreshShell: true,
		merge: (page, accepted) =>
			page.page === 'two-factor' && typeof accepted.enabled === 'boolean'
				? { ...page, payload: { ...page.payload, enabled: accepted.enabled } }
				: page,
	})
	const postTwoFactorAction = mutation.submit

	async function handleStartSetup() {
		setActionStatus('busy')
		setMessage(null)

		try {
			const payload = await postTwoFactorAction({ intent: 'setup' })
			// A null payload means a 401 redirect is already in flight.
			if (!payload) return
			if (!payload.otpUri || !payload.secret) {
				setMessage('The server returned an incomplete two-factor setup.')
				setMessageTone('error')
				return
			}
			let qrCodeDataUrl: string | null = null
			try {
				qrCodeDataUrl = await toDataURL(payload.otpUri, { width: 240 })
			} catch {
				qrCodeDataUrl = null
			}
			setSetup({
				otpUri: payload.otpUri,
				secret: payload.secret,
				qrCodeDataUrl,
			})
			setConfirmCode('')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to start two-factor setup.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	async function handleConfirmSetup(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const code = confirmCode.trim()
		if (!code) {
			setMessage('Enter the code from your authenticator app.')
			setMessageTone('error')
			return
		}

		setActionStatus('busy')
		setMessage(null)

		try {
			const payload = await postTwoFactorAction({ intent: 'confirm', code })
			if (!payload) return
			// Retire older setup loads before publishing the confirmed state.
			setSetup(null)
			setConfirmCode('')
			setMessage('Two-factor authentication is enabled.')
			setMessageTone('info')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to confirm two-factor setup.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	async function handleCancelSetup() {
		setActionStatus('busy')
		setMessage(null)

		try {
			const payload = await postTwoFactorAction({ intent: 'cancel' })
			// A null payload means a 401 redirect is already in flight.
			if (!payload) return
			setSetup(null)
			setConfirmCode('')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to cancel two-factor setup.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	async function handleDisable(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const code = disableCode.trim()
		if (!code) {
			setMessage('Enter a current code to disable two-factor authentication.')
			setMessageTone('error')
			return
		}

		setActionStatus('busy')
		setMessage(null)

		try {
			const payload = await postTwoFactorAction({ intent: 'disable', code })
			if (!payload) return
			setDisableCode('')
			setMessage('Two-factor authentication is disabled.')
			setMessageTone('info')
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to disable two-factor authentication.',
			)
			setMessageTone('error')
		} finally {
			setActionStatus('idle')
		}
	}

	function updateConfirmCode(event: FormEvent<HTMLInputElement>) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		setConfirmCode(event.currentTarget.value)
	}

	function updateDisableCode(event: FormEvent<HTMLInputElement>) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		setDisableCode(event.currentTarget.value)
	}

	const status = 'ready'

	const hydrated = useHydrated()
	const isBusy = !hydrated || actionStatus === 'busy'

	return (
		<AccountManagementShell maxWidth={layoutMaxWidths.content} busy={false}>
			<AccountPageHeader
				title="Two-factor authentication"
				description="Add a one-time code from an authenticator app as a second step when signing in."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}

			{status === 'ready' && enabled ? (
				<section css={cardCss}>
					<h2 css={cardTitleCss}>Two-factor authentication is enabled</h2>
					<p css={descriptionCss}>
						Signing in requires your password and a one-time code from your
						authenticator app. To disable it, confirm a current code below.
					</p>
					<form
						method="post"
						css={{ display: 'grid', gap: spacing.md }}
						onSubmit={handleDisable}
					>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Verification code</span>
							<input
								data-field-ring
								type="text"
								name="code"
								required
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{6}"
								placeholder="123456"
								value={disableCode}
								css={accountInputCss}
								onInput={updateDisableCode}
							/>
						</label>
						<div>
							<button type="submit" disabled={isBusy} css={dangerButtonCss}>
								{isBusy ? 'Working...' : 'Disable 2FA'}
							</button>
						</div>
					</form>
				</section>
			) : null}

			{status === 'ready' && !enabled && !setup ? (
				<section css={cardCss}>
					<h2 css={cardTitleCss}>Two-factor authentication is disabled</h2>
					<p css={descriptionCss}>
						Two-factor authentication adds an extra layer of security to your
						account. You will need to enter a code from an authenticator app
						like 1Password or Google Authenticator each time you sign in.
					</p>
					<div>
						<button
							type="button"
							disabled={isBusy}
							css={primaryButtonCss}
							onClick={handleStartSetup}
						>
							{isBusy ? 'Working...' : 'Enable 2FA'}
						</button>
					</div>
				</section>
			) : null}

			{status === 'ready' && !enabled && setup ? (
				<section css={cardCss}>
					<h2 css={cardTitleCss}>Scan this QR code</h2>
					<p css={descriptionCss}>
						Scan the QR code with your authenticator app, or enter the setup key
						manually, then confirm with a generated code. Two-factor
						authentication stays off until you confirm.
					</p>
					{setup.qrCodeDataUrl ? (
						<img
							src={setup.qrCodeDataUrl}
							alt="Two-factor authentication QR code"
							width={240}
							height={240}
							css={{
								borderRadius: radius.md,
								border: `1px solid ${colors.border}`,
								backgroundColor: '#fff',
							}}
						/>
					) : null}
					<p css={{ color: colors.textMuted, margin: 0 }}>
						Setup key:{' '}
						<code
							data-testid="totp-secret"
							css={{
								fontSize: typography.fontSize.sm,
								overflowWrap: 'anywhere',
							}}
						>
							{setup.secret}
						</code>
					</p>
					<form
						method="post"
						css={{ display: 'grid', gap: spacing.md }}
						onSubmit={handleConfirmSetup}
					>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Verification code</span>
							<input
								data-field-ring
								type="text"
								name="code"
								required
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="[0-9]{6}"
								placeholder="123456"
								value={confirmCode}
								css={accountInputCss}
								onInput={updateConfirmCode}
							/>
						</label>
						<div css={{ display: 'flex', gap: spacing.sm }}>
							<button type="submit" disabled={isBusy} css={primaryButtonCss}>
								{isBusy ? 'Working...' : 'Confirm'}
							</button>
							<button
								type="button"
								disabled={isBusy}
								css={secondaryButtonCss}
								onClick={handleCancelSetup}
							>
								Cancel
							</button>
						</div>
					</form>
				</section>
			) : null}

			<p css={{ margin: 0 }}>
				<SiteLink href="/account" css={primaryLinkCss}>
					Back to account
				</SiteLink>
			</p>
		</AccountManagementShell>
	)
}

const primaryButtonCss = getPillButtonCss({ size: 'sm' })
const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
const dangerButtonCss = getDangerPillCss({ size: 'sm' })

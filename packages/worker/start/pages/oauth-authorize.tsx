/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { SiteLink } from '../components/site-link.tsx'
import { normalizeRedirectTo } from '#universal/safe-redirect.ts'
import { Honeypot } from '../components/honeypot-field.tsx'
import { usePublicAuthProtection } from '../components/public-auth-protection.ts'
import { useRef, useState, type FormEvent } from 'react'
import { useHydrated } from '../components/use-hydrated.ts'
import { useLocation } from '@tanstack/react-router'
import { type OAuthAuthorizeLoaderData } from '#universal/loader-data.ts'
import {
	honeypotFieldName,
	readPublicFormProtection,
	turnstileResponseFieldName,
	turnstileWidgetClassName,
} from '#client/public-form-protection.ts'
import {
	renderEmailVerificationPrompt,
	requestResendVerification,
} from './email-verification-prompt.tsx'
import { resolveAuthorizeEmailVerified } from '#client/routes/oauth-authorize-email-verified.ts'
import {
	oauthAuthorizeActionsDisabled,
	oauthAuthorizeApproveAriaLabel,
	oauthAuthorizeConsentDecision,
	oauthAuthorizeConsentFormAttrs,
	oauthAuthorizeEmailVerificationDenyDisabled,
} from '#client/routes/oauth-authorize-form.ts'
import {
	fetchSessionInfo,
	getSessionDisplayName,
	type SessionInfo,
} from '#client/session.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	cardCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getAlertCardCss,
	getDangerButtonCss,
	getPrimaryButtonCss,
	getSecondaryButtonCss,
	insetCardCss,
	inputCss,
	mutedLinkCss,
	nativeDisclosureCss,
	pageDescriptionCss,
	pageEyebrowCss,
	pageHeaderCss,
	pageTitleCss,
	sectionTitleCss,
	stackedPageCss,
	visuallyHiddenCss,
} from '#universal/styles/style-primitives.ts'

type OAuthAuthorizeStatus = 'idle' | 'loading' | 'ready' | 'error'
type OAuthAuthorizeMessage = { type: 'error' | 'info'; text: string }
type OAuthAuthorizeDecision = 'approve' | 'deny' | 'reset-client'

function oauthAuthorizeAccessLead(
	status: OAuthAuthorizeStatus,
	clientLabel: string,
) {
	switch (status) {
		case 'ready':
			return `${clientLabel} wants to access your kody account.`
		case 'idle':
		case 'loading':
			return 'Loading authorization details…'
		case 'error':
			return null
		default: {
			const exhaustive: never = status
			return exhaustive
		}
	}
}

function renderOauthAuthorizeGrant(input: {
	clientLabel: string
	scopes: ReadonlyArray<string>
}) {
	return (
		<section data-testid="oauth-authorize-grant" css={cardCss}>
			<h2 css={sectionTitleCss}>This agent gets full access</h2>
			<p css={descriptionCss}>
				Approving lets {input.clientLabel} use everything in this Kody account:
				packages, memories, secrets, email, connected services, and anything
				else your assistant can do.
			</p>
			{input.scopes.length > 0 ? (
				<details
					data-testid="oauth-authorize-oidc-scopes"
					css={nativeDisclosureCss}
				>
					<summary>Identity claims on the token</summary>
					{/* nativeDisclosureCss grids each direct details child. */}
					<div>
						<p css={descriptionCss}>
							These OAuth scopes are identity claims. They do not limit what the
							assistant can do.
						</p>
						<p
							css={{
								...descriptionCss,
								display: 'flex',
								flexWrap: 'wrap',
								columnGap: spacing.md,
								rowGap: spacing.xs,
								alignItems: 'baseline',
							}}
						>
							{input.scopes.map((scope) => (
								<code key={scope}>{scope}</code>
							))}
						</p>
					</div>
				</details>
			) : null}
		</section>
	)
}

export function OAuthAuthorizeRoute({
	data,
	session,
}: {
	data: OAuthAuthorizeLoaderData
	session: SessionInfo | null
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshShell: true,
		refreshRoute: true,
	})
	const currentHref = useLocation({ select: (location) => location.href })
	const [messageOverride, setMessage] = useState<OAuthAuthorizeMessage | null>(
		null,
	)
	const message =
		messageOverride ??
		(!data.ok ? { type: 'error' as const, text: data.error } : null)
	const info = data.ok ? data : null
	const status: OAuthAuthorizeStatus = data.ok ? 'ready' : 'error'
	const allowClientReset = !data.ok && data.allowClientReset
	const [submittingDecision, setSubmittingDecision] =
		useState<OAuthAuthorizeDecision | null>(null)
	const submitting = useRef(false)
	const [resetCompleted, setResetCompleted] = useState(false)
	const [resendStatus, setResendStatus] = useState<'idle' | 'sending'>('idle')
	const [resendMessage, setResendMessage] = useState<string | null>(null)
	const [resendTone, setResendTone] = useState<'error' | 'info'>('info')
	const consentInteractive = useHydrated()
	const turnstileSiteKey = usePublicAuthProtection()
	function readOAuthResumeTarget() {
		return normalizeRedirectTo(currentHref)
	}
	async function refreshSession() {
		const nextSession = await fetchSessionInfo()
		await invalidatePages()
		return nextSession
	}
	async function handleResendVerification() {
		setResendStatus('sending')
		setResendMessage(null)
		setResendTone('info')
		try {
			const result = await requestResendVerification(readOAuthResumeTarget())
			setResendTone(result.ok ? 'info' : 'error')
			setResendMessage(result.message)
			if (result.ok) await refreshSession()
		} catch {
			setResendTone('error')
			setResendMessage('Unable to resend the verification email.')
		} finally {
			setResendStatus('idle')
		}
	}
	async function handleContinueAfterVerify() {
		try {
			const nextSession = await refreshSession()
			setResendTone('info')
			setResendMessage(
				nextSession?.emailVerified
					? 'Email verified. You can approve the connection now.'
					: 'Still waiting on verification. Keep this page open, finish verification in another tab, then continue.',
			)
		} catch {
			setResendTone('error')
			setResendMessage('Unable to check verification status. Try again.')
		}
	}

	async function submitDecision(
		decision: OAuthAuthorizeDecision,
		form?: HTMLFormElement,
	) {
		if (submitting.current) return
		submitting.current = true
		setSubmittingDecision(decision)

		try {
			const body = new URLSearchParams()
			body.set('decision', decision)
			if (decision === 'approve' && form) {
				const formData = new FormData(form)
				const email = String(formData.get('email') ?? '').trim()
				const password = String(formData.get('password') ?? '')
				if (!email || !password) {
					setMessage({
						type: 'error',
						text: 'Email and password are required.',
					})
					setSubmittingDecision(null)
					return
				}
				body.set('email', email)
				body.set('password', password)
				const protection = readPublicFormProtection(formData, form)
				body.set(honeypotFieldName, protection[honeypotFieldName])
				body.set(
					turnstileResponseFieldName,
					protection[turnstileResponseFieldName],
				)
			}
			const response = await fetch(window.location.href, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				credentials: 'include',
				body,
			})
			const payload = await response.json().catch(() => null)
			if (!response.ok) {
				const errorText =
					typeof payload?.error === 'string'
						? payload.error
						: 'Unable to complete authorization.'
				setMessage({ type: 'error', text: errorText })
				if (payload?.code === 'email_verification_required') {
					await refreshSession()
				}
				setSubmittingDecision(null)
				return
			}
			if (payload?.redirectTo) {
				window.location.assign(payload.redirectTo)
				return
			}
			if (typeof payload?.message === 'string') {
				setResetCompleted(true)
				setSubmittingDecision(null)
				setMessage({ type: 'info', text: payload.message })
				return
			}
			setMessage({ type: 'error', text: 'Missing redirect response.' })
		} catch {
			setMessage({
				type: 'error',
				text: 'Network error. Please try again.',
			})
		} finally {
			submitting.current = false
			setSubmittingDecision(null)
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const requireCredentials = info?.requireCredentials === true
		const hasSession = Boolean(session?.email) && !requireCredentials
		await submitDecision(
			'approve',
			hasSession ? undefined : event.currentTarget,
		)
	}

	const clientLabel = info?.client?.name ?? 'Unknown client'
	const scopes = info?.scopes ?? []
	const sessionEmail = session?.email ?? ''
	const sessionDisplayName = getSessionDisplayName(session)
	const isSessionReady = true
	const isSessionLoading = false
	const requireCredentials = info?.requireCredentials === true
	const isLoggedIn =
		isSessionReady && Boolean(sessionEmail) && !requireCredentials
	const emailVerified = resolveAuthorizeEmailVerified({
		isSessionReady,
		sessionEmailVerified: session?.emailVerified,
		infoEmailVerified: info?.emailVerified,
	})
	const needsEmailVerification = isLoggedIn && !emailVerified
	const showResetClientCard = allowClientReset && !resetCompleted
	const showAuthorizeForm =
		!resetCompleted && !needsEmailVerification && status !== 'error'
	const hydrated = consentInteractive
	const consentForm = oauthAuthorizeConsentFormAttrs(currentHref)
	const actionsDisabled = oauthAuthorizeActionsDisabled({
		hydrated,
		statusReady: status === 'ready',
		submitting: Boolean(submittingDecision),
		sessionLoading: isSessionLoading,
		needsEmailVerification,
	})
	const resetClientDisabled =
		Boolean(submittingDecision) || isSessionLoading || !isLoggedIn
	const formReady = hydrated && status === 'ready' && !isSessionLoading
	const accessLead = oauthAuthorizeAccessLead(status, clientLabel)
	const authorizeLabel = submittingDecision
		? 'Submitting...'
		: isLoggedIn
			? 'Approve connection'
			: 'Authorize'
	const approveAriaLabel = oauthAuthorizeApproveAriaLabel({
		hydrated,
		label: authorizeLabel,
	})
	const resetClientLabel =
		submittingDecision === 'reset-client'
			? 'Resetting this connection...'
			: 'Reset this connection'

	return (
		<section css={pageCss}>
			<header css={headerCss}>
				<span css={eyebrowCss}>Kody secure connection</span>
				<h1 css={pageTitleCss}>Authorize access</h1>
				{accessLead ? <p css={pageDescriptionCss}>{accessLead}</p> : null}
			</header>
			{status === 'ready'
				? renderOauthAuthorizeGrant({ clientLabel, scopes })
				: null}
			{isLoggedIn ? (
				<section css={insetCardCss}>
					<p
						css={{
							margin: 0,
							fontWeight: typography.fontWeight.medium,
							color: colors.text,
						}}
					>
						Signed in as {sessionDisplayName}
					</p>
					<p css={descriptionCss}>
						{resetCompleted
							? 'Start the connection again from your client to continue with this account.'
							: needsEmailVerification
								? 'Verify your email before approving MCP access. Keep this page open so the original OAuth request is preserved.'
								: 'Approve to continue with this account.'}
					</p>
				</section>
			) : null}
			{needsEmailVerification
				? renderEmailVerificationPrompt({
						email: sessionEmail,
						description:
							'MCP authorization cannot finish until this account email is verified. Resend the link here if needed. Keep this page open, verify in another tab, then continue without restarting the host connection.',
						delivery: session?.emailVerificationDelivery ?? null,
						resendStatus,
						resendMessage,
						resendTone,
						onResend: () => {
							void handleResendVerification()
						},
						continueLabel: "I've verified - continue",
						onContinue: () => {
							void handleContinueAfterVerify()
						},
					})
				: null}
			{needsEmailVerification && !resetCompleted ? (
				<div css={{ marginBottom: spacing.md }}>
					<button
						type="button"
						data-testid="oauth-authorize-email-verify-deny"
						disabled={oauthAuthorizeEmailVerificationDenyDisabled({
							hydrated,
							submitting: Boolean(submittingDecision),
							sessionLoading: isSessionLoading,
						})}
						aria-label={oauthAuthorizeApproveAriaLabel({
							hydrated,
							label: 'Deny',
						})}
						onClick={() => submitDecision('deny')}
						css={secondaryButtonCss}
					>
						Deny
					</button>
				</div>
			) : null}
			{message ? (
				<p
					role={message.type === 'error' ? 'alert' : undefined}
					css={getAlertCardCss(message.type)}
				>
					{message.text}
				</p>
			) : null}
			{showResetClientCard ? (
				<section css={cardCss}>
					<p css={sectionTitleCss}>Reset stored connection</p>
					<p css={descriptionCss}>
						Revoke this account&apos;s grants for the client, then start the
						connection again. Shared client registrations used by other accounts
						stay in place.
					</p>
					{isLoggedIn ? (
						<button
							type="button"
							disabled={resetClientDisabled}
							onClick={() => submitDecision('reset-client')}
							css={dangerButtonCss}
						>
							{resetClientLabel}
						</button>
					) : isSessionReady ? (
						<p css={descriptionCss}>
							Sign in first, then reset this connection.
						</p>
					) : null}
				</section>
			) : null}
			{showAuthorizeForm ? (
				<form
					method={consentForm.method}
					action={consentForm.action}
					data-testid="oauth-authorize-form"
					aria-busy={hydrated ? undefined : 'true'}
					css={{
						...cardCss,
						opacity: formReady ? 1 : 0.7,
					}}
					onSubmit={handleSubmit}
				>
					{hydrated ? null : (
						<p role="status" css={visuallyHiddenCss}>
							Connection approval is available after the page finishes loading.
						</p>
					)}
					<input
						type="hidden"
						name="decision"
						value={oauthAuthorizeConsentDecision}
					/>
					<Honeypot />
					{!isLoggedIn && isSessionReady ? (
						<>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Email</span>
								<input
									type="email"
									name="email"
									required
									autoComplete="email"
									placeholder="you@example.com"
									disabled={actionsDisabled}
									css={inputCss}
								/>
							</label>
							<label css={fieldCss}>
								<span css={fieldLabelCss}>Password</span>
								<input
									type="password"
									name="password"
									required
									autoComplete="current-password"
									placeholder="Enter your password"
									disabled={actionsDisabled}
									css={inputCss}
								/>
							</label>
						</>
					) : null}
					{!isLoggedIn && turnstileSiteKey ? (
						<div className={turnstileWidgetClassName}></div>
					) : null}
					<div css={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
						<button
							type="submit"
							data-testid="oauth-authorize-approve"
							disabled={actionsDisabled}
							aria-label={approveAriaLabel}
							css={primaryButtonCss}
						>
							{authorizeLabel}
						</button>
						<button
							type="button"
							disabled={actionsDisabled}
							aria-label={oauthAuthorizeApproveAriaLabel({
								hydrated,
								label: 'Deny',
							})}
							onClick={() => submitDecision('deny')}
							css={secondaryButtonCss}
						>
							Deny
						</button>
					</div>
				</form>
			) : null}
			<SiteLink href="/" css={mutedLinkCss}>
				Back home
			</SiteLink>
		</section>
	)
}

const pageCss = {
	...stackedPageCss,
	maxWidth: '28rem',
	margin: '0 auto',
}

const headerCss = pageHeaderCss
const eyebrowCss = pageEyebrowCss
const primaryButtonCss = getPrimaryButtonCss({
	size: 'lg',
	weight: 'semibold',
})
const secondaryButtonCss = getSecondaryButtonCss({
	size: 'lg',
	weight: 'semibold',
})
const dangerButtonCss = getDangerButtonCss({
	size: 'lg',
	weight: 'semibold',
})

const mutationResources = [
	'loadAccountPage',
	'loadConnectionsPage',
	'loadOnboarding',
] as const

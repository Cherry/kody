/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { useEffect, useState } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { normalizeRedirectTo } from '#universal/safe-redirect.ts'
import { fetchSessionInfo } from '#client/session.ts'
import { resolveContinueVerificationFeedback } from '#client/routes/pending-verification-continue.ts'
import { resolvePostVerificationRedirect } from '#client/routes/pending-verification-path.ts'
import { buildAuthLink } from '#client/auth-links.ts'
import { acceptedEmailVerificationDelivery } from '#universal/email-verification-delivery.ts'
import { type PendingVerificationLoaderData } from '#universal/loader-data.ts'
import { mq, spacing } from '#universal/styles/tokens.ts'
import { layoutMaxWidths } from '#universal/styles/style-primitives.ts'
import {
	AccountManagementHeader,
	AccountManagementShell,
} from './account-management-components.tsx'
import {
	buildPendingVerificationPath,
	renderEmailVerificationPrompt,
	requestResendVerification,
} from './email-verification-prompt.tsx'

export function PendingVerificationPage({
	data,
}: {
	data: PendingVerificationLoaderData
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshShell: true,
		refreshRoute: true,
	})
	const search = useLocation({ select: (location) => location.searchStr })
	const redirectTo = normalizeRedirectTo(
		new URLSearchParams(search).get('redirectTo'),
	)
	const router = useRouter()
	const [delivery, setDelivery] = useState(
		data.emailVerificationDelivery ?? null,
	)
	const [resendStatus, setResendStatus] = useState<'idle' | 'sending'>('idle')
	const [resendMessage, setResendMessage] = useState<string | null>(null)
	const [resendTone, setResendTone] = useState<'error' | 'info'>('info')
	useEffect(() => {
		const controller = new AbortController()
		let timer: ReturnType<typeof setTimeout>
		const poll = async () => {
			try {
				if (document.visibilityState === 'visible') {
					const session = await fetchSessionInfo(controller.signal)
					if (controller.signal.aborted) return
					if (!session) {
						await router.navigate({
							href: buildAuthLink(
								'/login',
								buildPendingVerificationPath(redirectTo),
							),
						})
						return
					}
					if (session.emailVerified) {
						await router.navigate({
							href: resolvePostVerificationRedirect(redirectTo),
						})
						return
					}
					setDelivery(session.emailVerificationDelivery ?? null)
				}
			} catch {
				/* The next poll retries a transient delivery status failure. */
			}
			if (!controller.signal.aborted)
				timer = setTimeout(() => {
					void poll()
				}, 15_000)
		}
		timer = setTimeout(() => {
			void poll()
		}, 15_000)
		return () => {
			controller.abort()
			clearTimeout(timer)
		}
	}, [redirectTo, router])
	async function resend() {
		setResendStatus('sending')
		setResendMessage(null)
		setResendTone('info')
		try {
			const result = await requestResendVerification(redirectTo)
			if (result.ok) void invalidatePages()
			if (!result.ok && result.unauthorized) {
				await router.navigate({
					href: buildAuthLink(
						'/login',
						buildPendingVerificationPath(redirectTo),
					),
				})
				return
			}
			setResendTone(result.ok ? 'info' : 'error')
			setResendMessage(result.message)
			if (result.ok) setDelivery(acceptedEmailVerificationDelivery())
		} catch {
			setResendTone('error')
			setResendMessage('Unable to resend the verification email.')
		} finally {
			setResendStatus('idle')
		}
	}
	async function continueAfterVerification() {
		try {
			const feedback = resolveContinueVerificationFeedback(
				await fetchSessionInfo(),
			)
			if (feedback.status === 'verified') {
				await router.navigate({
					href: resolvePostVerificationRedirect(redirectTo),
				})
				return
			}
			setResendTone(feedback.tone)
			setResendMessage(feedback.message)
		} catch {
			setResendTone('error')
			setResendMessage('Unable to check verification status. Try again.')
		}
	}
	return (
		<AccountManagementShell maxWidth={layoutMaxWidths.content}>
			<div
				data-testid="pending-verification-page"
				css={pendingVerificationLayoutCss}
			>
				<img
					src="/images/kody-envelope.png"
					alt="Kody holding a sealed envelope with a green wax K stamp"
					width={686}
					height={1305}
					css={pendingVerificationImageCss}
				/>
				<div css={pendingVerificationCopyCss}>
					<AccountManagementHeader
						title="Check your email"
						description="Your Kody account is ready. Verify your email before connecting an AI agent or using MCP."
					/>
					{renderEmailVerificationPrompt({
						email: data.email,
						description:
							'We sent a verification link to your inbox. MCP access stays locked until you verify. Keep this browser signed in so you can resend the email or continue once the link works.',
						delivery,
						resendStatus,
						resendMessage,
						resendTone,
						onResend: () => {
							void resend()
						},
						continueLabel: "I've verified - continue",
						onContinue: () => {
							void continueAfterVerification()
						},
						secondaryHref: '/account',
						secondaryLabel: 'Account settings',
					})}
				</div>
			</div>
		</AccountManagementShell>
	)
}

const pendingVerificationLayoutCss = {
	display: 'grid',
	gridTemplateColumns: 'auto minmax(0, 1fr)',
	gap: spacing.xl,
	alignItems: 'center',
	[mq.mobile]: {
		gridTemplateColumns: 'minmax(0, 1fr)',
		justifyItems: 'center',
		gap: spacing.lg,
	},
}

const pendingVerificationImageCss = {
	width: 'min(16rem, 36vw)',
	maxHeight: 'min(28rem, 70vh)',
	height: 'auto',
	objectFit: 'contain' as const,
	display: 'block',
	[mq.mobile]: {
		width: 'min(12rem, 58vw)',
		maxHeight: 'min(18rem, 38vh)',
	},
}

const pendingVerificationCopyCss = {
	display: 'grid',
	gap: spacing.lg,
	minWidth: 0,
	width: '100%',
}

const mutationResources = ['loadAccountPage'] as const

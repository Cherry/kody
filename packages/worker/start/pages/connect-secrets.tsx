/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { type CSSObject } from '@emotion/react'
import { useState, useEffect, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { SiteLink } from '../components/site-link.tsx'
import { type AccountSecretsLoaderData } from '#universal/loader-data.ts'

import {
	type ApprovalAction,
	type ApprovalView,
	accountSecretsApiPath,
	allowHostsButtonLabel,
	approvalRejectedHosts,
	approvalRequestedHosts,
	submitApprovalRequest,
} from '#client/routes/account-approval-shared.ts'

import { colors, spacing } from '#universal/styles/tokens.ts'
import {
	cardCss,
	getAccentCalloutCss,
	getPrimaryButtonCss,
	getSecondaryButtonCss,
	pageDescriptionCss,
	pageEyebrowCss,
	pageHeaderCss,
	pageTitleCss,
	stackedPageCss,
} from '#universal/styles/style-primitives.ts'
import { routes } from '#universal/routes.ts'

const connectSecretsPageCss: CSSObject = {
	...stackedPageCss,
	maxWidth: '32rem',
	margin: '0 auto',
}

const connectSecretsHeaderCss: CSSObject = {
	...pageHeaderCss,
	justifyItems: 'center',
	textAlign: 'center' as const,
}

const connectSecretsPrimaryButtonCss = getPrimaryButtonCss({
	size: 'lg',
	weight: 'semibold',
})

const connectSecretsSecondaryButtonCss = getSecondaryButtonCss({
	size: 'lg',
	weight: 'semibold',
})

export function ConnectSecretsRoute({
	initialData,
}: {
	initialData: AccountSecretsLoaderData
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshRoute: true,
	})
	const href = useLocation({ select: (l) => l.href })
	const [data, setData] = useState(initialData),
		[message, setMessage] = useState<string | null>(null)
	const [previousData, setPreviousData] = useState(initialData)
	if (previousData !== initialData) {
		setPreviousData(initialData)
		setData(initialData)
	}
	const mounted = useRef(false),
		busy = useRef(false)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const [completed, setCompleted] = useState<ApprovalAction | null>(null),
		[submittingAction, setSubmittingAction] = useState<ApprovalAction | null>(
			null,
		)
	async function submitApproval(action: ApprovalAction) {
		if (busy.current || !data.approval) return
		busy.current = true
		setSubmittingAction(action)
		setMessage(null)
		try {
			const url = new URL(accountSecretsApiPath, 'http://localhost')
			url.search = new URL(href, 'http://localhost').search
			const payload = await submitApprovalRequest<
				AccountSecretsLoaderData & { error?: string; ok?: boolean }
			>(action, url.pathname + url.search)
			if (payload && mounted.current) {
				setData(payload)
				setCompleted(action)
				void invalidatePages()
			}
		} catch (error) {
			if (mounted.current)
				setMessage(
					error instanceof Error
						? error.message
						: 'Unable to process approval.',
				)
		} finally {
			busy.current = false
			if (mounted.current) setSubmittingAction(null)
		}
	}

	const approval = data?.approval ?? null
	const rejectedHosts = approval ? approvalRejectedHosts(approval) : []
	const alreadyAllowed =
		approval != null &&
		completed !== 'reject' &&
		isConnectSecretsAlreadyAllowed({
			secrets: data?.secrets ?? [],
			approval,
		})
	const hosts = approval ? approvalRequestedHosts(approval) : []
	const names = approval?.names.length ? approval.names : []
	const view = readConnectSecretsView({
		hostCount: hosts.length,
		rejectedCount: rejectedHosts.length,
		completed,
		alreadyAllowed,
	})
	const { onlyInvalid, fullyAllowed, leftoverInvalid, showBackToSecrets } = view

	return (
		<section css={connectSecretsPageCss} data-testid="connect-secrets">
			<header css={connectSecretsHeaderCss}>
				<span css={pageEyebrowCss}>Allow secret hosts</span>
				<h1 css={pageTitleCss}>
					{fullyAllowed
						? 'Access allowed'
						: leftoverInvalid
							? 'Some hosts could not be allowed'
							: onlyInvalid
								? 'These hosts are not valid'
								: completed === 'reject'
									? 'Request rejected'
									: 'Allow this secret at these hosts'}
				</h1>
				<p css={pageDescriptionCss}>
					{fullyAllowed
						? 'Kody can send this saved secret to the hosts below.'
						: leftoverInvalid
							? 'Valid hosts were allowed. Invalid hosts from this link were not written to the allowlist — copy the approval link again if it was truncated.'
							: onlyInvalid
								? 'Kody did not treat these values as hosts you can allow. Copy the approval link again if it was truncated.'
								: completed === 'reject'
									? 'No hosts were added. You can approve later from this same link.'
									: approval
										? 'Kody only sends a saved secret to hosts you approve. Saving a secret does not do this automatically.'
										: 'Open an approval link from Kody to allow a saved secret at a host.'}
				</p>
			</header>

			{data?.approvalError ? (
				<section
					css={{
						...cardCss,
						border: `1px solid ${colors.danger}`,
					}}
					data-testid="connect-secrets-error"
				>
					<p css={{ margin: 0, color: colors.danger }}>{data.approvalError}</p>
				</section>
			) : null}

			{message ? (
				<p css={{ margin: 0, color: colors.danger }}>{message}</p>
			) : null}

			{approval && (hosts.length > 0 || rejectedHosts.length > 0) ? (
				<section css={cardCss} data-testid="connect-secrets-card">
					<div css={{ display: 'grid', gap: spacing.sm }}>
						<div css={{ display: 'grid', gap: spacing.xs }}>
							<span css={{ color: colors.textMuted }}>
								{names.length === 1 ? 'Secret' : 'Secrets'}
							</span>
							<ul
								css={{
									margin: 0,
									paddingLeft: spacing.lg,
									display: 'grid',
									gap: spacing.xs,
								}}
							>
								{names.map((name) => (
									<li key={name}>
										<code>{name}</code>
									</li>
								))}
							</ul>
						</div>
						{hosts.length > 0 ? (
							<div css={{ display: 'grid', gap: spacing.xs }}>
								<span css={{ color: colors.textMuted }}>
									{hosts.length === 1 ? 'Host' : 'Hosts'}
								</span>
								<ul
									css={{
										margin: 0,
										paddingLeft: spacing.lg,
										display: 'grid',
										gap: spacing.xs,
									}}
								>
									{hosts.map((host) => (
										<li key={host}>
											<strong css={{ color: colors.text }}>{host}</strong>
										</li>
									))}
								</ul>
							</div>
						) : null}
						{rejectedHosts.length > 0 ? (
							<div
								css={getAccentCalloutCss({ accentColor: colors.danger })}
								data-testid="connect-secrets-rejected-hosts"
							>
								<span css={{ color: colors.danger, fontWeight: 600 }}>
									{rejectedHosts.length === 1
										? 'This host is not valid'
										: `${rejectedHosts.length} hosts are not valid`}
								</span>
								<ul
									css={{
										margin: 0,
										paddingLeft: spacing.lg,
										display: 'grid',
										gap: spacing.xs,
									}}
								>
									{rejectedHosts.map((entry) => (
										<li key={entry.host}>
											<strong css={{ color: colors.text }}>{entry.host}</strong>
											<span css={{ color: colors.textMuted }}>
												{' '}
												— {entry.message}
											</span>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
					{showBackToSecrets ? (
						<SiteLink
							href={routes.accountSecrets.href()}
							css={connectSecretsSecondaryButtonCss}
						>
							Back to secrets
						</SiteLink>
					) : (
						<div
							css={{
								display: 'flex',
								gap: spacing.sm,
								flexWrap: 'wrap',
							}}
						>
							{hosts.length > 0 && completed !== 'approve' ? (
								<button
									type="button"
									disabled={submittingAction != null}
									onClick={() => {
										void submitApproval('approve')
									}}
									css={connectSecretsPrimaryButtonCss}
								>
									{submittingAction === 'approve'
										? 'Allowing access…'
										: allowHostsButtonLabel(hosts.length, rejectedHosts.length)}
								</button>
							) : null}
							<button
								type="button"
								disabled={submittingAction != null}
								onClick={() => {
									void submitApproval('reject')
								}}
								css={connectSecretsSecondaryButtonCss}
							>
								Reject
							</button>
						</div>
					)}
				</section>
			) : null}
		</section>
	)
}

function readConnectSecretsView(input: {
	hostCount: number
	rejectedCount: number
	completed: ApprovalAction | null
	alreadyAllowed: boolean
}) {
	const onlyInvalid =
		input.hostCount === 0 &&
		input.rejectedCount > 0 &&
		input.completed !== 'reject'
	const fullyAllowed =
		(input.completed === 'approve' || input.alreadyAllowed) &&
		input.rejectedCount === 0 &&
		!onlyInvalid
	const leftoverInvalid =
		input.rejectedCount > 0 &&
		(input.completed === 'approve' || input.alreadyAllowed)
	return {
		onlyInvalid,
		fullyAllowed,
		leftoverInvalid,
		showBackToSecrets:
			fullyAllowed ||
			leftoverInvalid ||
			input.alreadyAllowed ||
			input.completed === 'reject',
	}
}

function isConnectSecretsAlreadyAllowed(input: {
	secrets: AccountSecretsLoaderData['secrets']
	approval: ApprovalView
}) {
	if (approvalRequestedHosts(input.approval).length === 0) return false
	const pendingPairs = collectPendingHostPairs(input.secrets, input.approval)
	if (pendingPairs.length > 0) return false
	return input.approval.names.every((name) =>
		input.secrets.some(
			(item) => item.name === name && item.scope === input.approval.scope,
		),
	)
}

function collectPendingHostPairs(
	secrets: AccountSecretsLoaderData['secrets'],
	approval: ApprovalView,
) {
	const hosts = approvalRequestedHosts(approval)
	const pairs: Array<{ name: string; host: string }> = []
	for (const name of approval.names) {
		const secret = secrets.find(
			(item) => item.name === name && item.scope === approval.scope,
		)
		if (!secret) continue
		for (const host of hosts) {
			if (!secret.allowedHosts.includes(host)) {
				pairs.push({ name, host })
			}
		}
	}
	return pairs
}

const mutationResources = [
	'loadSecretsPage',
	'loadOnboarding',
	'loadAccountPage',
] as const

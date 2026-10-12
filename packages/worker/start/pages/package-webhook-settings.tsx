/** @jsxImportSource @emotion/react */
import { useEffect, useRef, useState } from 'react'
import { usePageInvalidation } from '../page-invalidation.ts'
import { type PackageWebhookListItem } from '#universal/loader-data.ts'
import {
	fetchPackageWebhooks,
	postPackageWebhookIntent,
	type WebhookIntent,
	webhookFailureMessage,
	webhookSuccessMessage,
	packageWebhooksSectionId,
	webhooksDocHref,
} from '#client/routes/webhooks-shared.ts'
import { renderPackageWebhookCard as PackageWebhookCard } from './package-webhook-card.tsx'
import { AccountManagementMessage } from './account-management-components.tsx'
import { SiteLink } from '../components/site-link.tsx'
import { detailSectionCss } from '../components/community-detail-sections.tsx'
import { primaryLinkCss } from '#universal/styles/style-primitives.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
export function PackageWebhookSettings({
	username,
	kodyId,
}: {
	username: string
	kodyId: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const mounted = useRef(false),
		mutatingRef = useRef(false)
	const [webhooks, setWebhooks] = useState<PackageWebhookListItem[]>([])
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [message, setMessage] = useState<string | null>(null),
		[messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [mutating, setMutating] = useState(false),
		[revealedUrls, setRevealedUrls] = useState<Map<string, string>>(new Map())
	const [confirmed, setConfirmed] = useState<string | null>(null)
	useEffect(() => {
		mounted.current = true
		let active = true
		void fetchPackageWebhooks({ username, kodyId })
			.then((result) => {
				if (!active) return
				if (result.kind === 'unauthorized') {
					window.location.assign('/login')
					return
				}
				setWebhooks(result.payload.webhooks)
				setStatus('ready')
			})
			.catch((error) => {
				if (active) {
					setStatus('error')
					setMessage(
						error instanceof Error ? error.message : 'Unable to load webhooks.',
					)
					setMessageTone('error')
				}
			})
		return () => {
			active = false
			mounted.current = false
		}
	}, [username, kodyId])
	async function runIntent(
		webhook: PackageWebhookListItem,
		intent: WebhookIntent,
	) {
		if (mutatingRef.current) return
		mutatingRef.current = true
		setMutating(true)
		setMessage(null)
		try {
			const result = await postPackageWebhookIntent({
				username,
				kodyId,
				webhookName: webhook.name,
				intent,
			})
			if (!mounted.current) return
			if (result.kind === 'unauthorized') {
				window.location.assign('/login')
				return
			}
			if (result.kind === 'error') {
				setMessage(result.message || webhookFailureMessage(intent))
				setMessageTone('error')
				return
			}
			setWebhooks(result.payload.webhooks)
			setConfirmed(null)
			setRevealedUrls((previous) => {
				const next = new Map(previous)
				if (intent === 'rotate') next.delete(webhook.id)
				if (result.payload.revealed)
					next.set(result.payload.revealed.id, result.payload.revealed.url)
				return next
			})
			setMessage(webhookSuccessMessage(intent))
			setMessageTone('info')
			void invalidatePages()
		} catch {
			if (mounted.current) {
				setMessage(webhookFailureMessage(intent))
				setMessageTone('error')
			}
		} finally {
			mutatingRef.current = false
			if (mounted.current) setMutating(false)
		}
	}
	function confirmation(
		webhook: PackageWebhookListItem,
		intent: 'rotate' | 'disable',
	) {
		const key = `${webhook.id}:${intent}`
		return {
			armed: confirmed === key,
			onBlur: () => setConfirmed(null),
			onClick: () => {
				if (confirmed === key) void runIntent(webhook, intent)
				else setConfirmed(key)
			},
		}
	}
	const mutedCss = { margin: `${spacing.md} 0 0`, color: colors.textMuted }
	return (
		<section
			id={packageWebhooksSectionId}
			aria-labelledby="package-webhooks-title"
			aria-busy={status === 'loading' || mutating}
			data-testid="package-webhook-settings"
			css={{ ...detailSectionCss, scrollMarginTop: spacing.xl }}
		>
			<h2 id="package-webhooks-title">Webhooks</h2>
			<p>
				Inbound webhook URLs this package declares in{' '}
				<code>package.json#kody.webhooks</code>. Mint a URL here, copy it into
				the provider that will POST to it, and rotate or disable it when it
				leaks or goes unused. Rotate keeps the previous URL live for a short
				overlap so providers can finish switching. Agents connected over MCP can
				mint and apply handles but never see these URLs.
			</p>
			{status === 'loading' ? (
				<p role="status" css={mutedCss}>
					Loading webhooks…
				</p>
			) : null}
			{message ? (
				<div css={{ marginTop: spacing.md }}>
					<AccountManagementMessage tone={messageTone}>
						{message}
					</AccountManagementMessage>
				</div>
			) : null}
			{status === 'ready' && !webhooks.length ? (
				<p css={mutedCss} data-testid="package-webhook-settings-empty">
					This package declares no webhooks yet. Add a{' '}
					<code>kody.webhooks</code> entry to its <code>package.json</code> and
					publish it.{' '}
					<SiteLink href={webhooksDocHref} css={primaryLinkCss}>
						Inbound webhooks docs
					</SiteLink>
				</p>
			) : null}
			{status === 'ready' && webhooks.length ? (
				<>
					<p css={mutedCss} data-testid="package-webhook-settings-count">
						{webhooks.length} declared ·{' '}
						{webhooks.filter((x) => x.minted).length} minted
					</p>
					<div
						css={{ display: 'grid', gap: spacing.md, marginTop: spacing.lg }}
					>
						{webhooks.map((webhook) => (
							<div key={webhook.id}>
								{
									<PackageWebhookCard
										{...{
											webhook,
											revealedUrl: revealedUrls.get(webhook.id) ?? null,
											isMutating: mutating,
											rotateCheck: confirmation(webhook, 'rotate'),
											disableCheck: confirmation(webhook, 'disable'),
											onIntent: (intent) => void runIntent(webhook, intent),
											onHideUrl: () =>
												setRevealedUrls((previous) => {
													const next = new Map(previous)
													next.delete(webhook.id)
													return next
												}),
										}}
									/>
								}
							</div>
						))}
					</div>
				</>
			) : null}
		</section>
	)
}

const mutationResources = ['loadPackage', 'loadWebhooksPage'] as const

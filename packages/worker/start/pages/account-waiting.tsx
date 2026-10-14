/** @jsxImportSource @emotion/react */
import { SiteLink } from '../components/site-link.tsx'

import {
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	noticeCardCss,
} from './account-management-components.tsx'
import { type AccountWaitingLoaderData } from '#universal/loader-data.ts'
import { type WaitingItem, type WaitingSeverity } from '#universal/waiting.ts'
import { routes } from '#universal/routes.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
import {
	getAccentCalloutCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'

const severityAccent: Record<WaitingSeverity, string> = {
	block: colors.danger,
	degraded: colors.primary,
	setup: colors.border,
}

export function AccountWaitingPage({
	payload: initialPayload,
	currentHref,
}: {
	payload: AccountWaitingLoaderData
	currentHref: string
}) {
	const data = initialPayload

	return (
		<AccountManagementShell currentHref={currentHref} busy={false}>
			<AccountPageHeader
				title="Waiting"
				description="Things that need you."
				currentHref={currentHref}
			/>

			{data ? renderWaitingBody(data.items, currentHref) : null}
		</AccountManagementShell>
	)
}

function renderWaitingBody(items: Array<WaitingItem>, currentHref: string) {
	if (items.length === 0) {
		return (
			<AccountManagementPanel
				title="Nothing is waiting on you"
				description="Connections are healthy, and no publishes or grants need a click."
			>
				<p css={{ margin: 0, color: colors.textMuted }}>
					<SiteLink
						href={relocateAccountHref('/account/activity', currentHref)}
					>
						Activity
					</SiteLink>{' '}
					is run history.{' '}
					<SiteLink href={relocateAccountHref('/account/email', currentHref)}>
						Email
					</SiteLink>{' '}
					is your mailbox.
				</p>
			</AccountManagementPanel>
		)
	}

	return (
		<div
			css={{
				display: 'grid',
				gap: spacing.md,
			}}
		>
			{items.map((item) => (
				<section
					key={item.id}
					data-testid={`waiting-item-${item.kind}`}
					css={{
						...noticeCardCss,
						...getAccentCalloutCss({
							accentColor: severityAccent[item.severity],
						}),
					}}
				>
					<h2
						css={{
							margin: 0,
							fontSize: '1.05rem',
							fontWeight: 700,
							letterSpacing: '-0.01em',
							lineHeight: 1.3,
						}}
					>
						{item.title}
					</h2>
					<p
						css={{
							margin: 0,
							color: colors.textMuted,
							fontSize: '0.95rem',
							lineHeight: 1.5,
						}}
					>
						{item.why}
					</p>
					<SiteLink
						href={relocateAccountHref(item.href, currentHref)}
						onClick={() => {
							void fetch(routes.accountWaitingClickPost.href(), {
								method: 'POST',
								credentials: 'include',
								referrer: orgAccountApiReferrer(currentHref),
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify({ cardId: item.id }),
								keepalive: true,
							}).catch(() => {})
						}}
						css={{
							...getPillButtonCss({ size: 'sm' }),
							width: 'fit-content',
							textDecoration: 'none',
						}}
					>
						{item.doLabel}
					</SiteLink>
				</section>
			))}
		</div>
	)
}

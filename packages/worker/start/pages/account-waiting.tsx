/** @jsxImportSource @emotion/react */
import { recordWaitingClick } from '#start/server/account-mutations'
import { SiteLink } from '../components/site-link.tsx'
import { pageQueryOrg } from '../page-query-scope.ts'

import { type AccountWaitingLoaderData } from '#universal/loader-data.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import {
	getAccentCalloutCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
import { type WaitingItem, type WaitingSeverity } from '#universal/waiting.ts'
import {
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	noticeCardCss,
} from './account-management-components.tsx'

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
							void recordWaitingClick({
								data: {
									cardId: item.id,
									orgSlug: pageQueryOrg(currentHref) ?? undefined,
								},
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

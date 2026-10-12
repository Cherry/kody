/** @jsxImportSource @emotion/react */
import { SiteLink } from './site-link.tsx'
import { type CSSObject } from '@emotion/react'
import { type ReactNode } from 'react'
import {
	type PackageShareGrantLoaderView,
	defaultPackageShareTrustLevel,
} from '#universal/package-share.ts'
import {
	getAccentCalloutCss,
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'

type PackageShareBannersProps = {
	shareGrant: PackageShareGrantLoaderView | null | undefined
	loggedIn: boolean
	busy?: boolean
	message?: string | null
	onAccept?: (trustLevel: 'follow' | 'pin') => void
	onLeave?: () => void
}

export function renderPackageShareBanners(
	props: PackageShareBannersProps,
): ReactNode {
	const grant = props.shareGrant
	if (!grant) return null
	if (grant.status === 'pending') {
		return (
			<section css={bannerCss} data-testid="package-share-accept-banner">
				<strong>Accept this shared package</strong>
				<p>
					@{grant.ownerUsername} invited you to use {grant.packageName}. You can
					read source and invoke it. You cannot publish, write, or create jobs,
					apps, webhooks, or subscriptions on it.
				</p>
				{props.loggedIn ? (
					<div css={actionsCss}>
						<button
							type="button"
							disabled={props.busy}
							data-testid="package-share-accept-pin"
							css={getPillButtonCss()}
							onClick={() => props.onAccept?.(defaultPackageShareTrustLevel)}
						>
							Accept and pin this version
						</button>
						<button
							type="button"
							disabled={props.busy}
							data-testid="package-share-accept-follow"
							css={getGhostButtonCss()}
							onClick={() => props.onAccept?.('follow')}
						>
							Accept and follow future publishes
						</button>
					</div>
				) : (
					<p>
						<SiteLink href="/signup">Create an account</SiteLink>, join a paid
						plan, then accept.
					</p>
				)}
				{props.message ? <p>{props.message}</p> : null}
			</section>
		)
	}
	if (
		grant.status === 'accepted' &&
		grant.pinAhead &&
		grant.approveChangesPath
	) {
		return (
			<section css={bannerCss} data-testid="package-share-pin-ahead-banner">
				<strong>This shared package published ahead of your pin</strong>
				<p>
					Use and import stay blocked until you review the diff and approve the
					new published commit.
				</p>
				<div css={actionsCss}>
					<SiteLink
						href={grant.approveChangesPath}
						css={getPillButtonCss()}
						data-testid="package-share-approve-changes-link"
					>
						Approve changes
					</SiteLink>
					{props.onLeave ? (
						<button
							type="button"
							disabled={props.busy}
							css={getGhostButtonCss()}
							onClick={() => props.onLeave?.()}
						>
							Leave
						</button>
					) : null}
				</div>
				{props.message ? <p>{props.message}</p> : null}
			</section>
		)
	}
	if (grant.status === 'accepted') {
		return (
			<p css={statusCss} data-testid="package-share-accepted-status">
				Shared with you as use
				{grant.trustLevel ? ` · ${grant.trustLevel}` : ''}.
			</p>
		)
	}
	return null
}

const bannerCss = {
	...getAccentCalloutCss({ accentColor: colors.primary }),
	margin: `${spacing.lg} 0`,
	'& p': {
		margin: '0.35rem 0 0',
		color: colors.textMuted,
	},
} satisfies CSSObject

const actionsCss = {
	display: 'flex',
	flexWrap: 'wrap' as const,
	gap: spacing.sm,
	marginTop: spacing.md,
} satisfies CSSObject

const statusCss = {
	margin: `${spacing.md} 0 0`,
	color: colors.textMuted,
	fontSize: '0.92rem',
} satisfies CSSObject

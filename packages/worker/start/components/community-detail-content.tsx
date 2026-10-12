/** @jsxImportSource @emotion/react */
import { SiteLink } from './site-link.tsx'
/** @jsxRuntime automatic */
import { type CSSObject } from '@emotion/react'
import { type CSSProperties } from 'react'
import { buildPackageAppPath } from '@kody-internal/shared/public-urls.ts'
import { type PublicCommunityListing } from '#universal/community-public-types.ts'
import { communityPackageCategoryCopy } from '#universal/community-categories.ts'
import { buildCommunityIndexHref } from '#universal/community-search.ts'
import {
	formatCommunityAdaptationEffort,
	formatCommunityPublishedDate,
	formatCommunityStars,
	shortCommunityCommit,
} from '#universal/community-display.ts'
import { renderIcon } from './icon.tsx'
import { renderPackageTitleActions } from './package-title-actions.tsx'
import {
	communityTagListCss,
	communityTagPillCss,
	renderCommunityViewerInstallBadge,
} from './community-listings-content.tsx'
import {
	fallbackDefaultBranchName,
	getPackageTreeHref,
} from '#universal/package-files.ts'
import { renderPackageRepoChrome } from './package-repo-nav.tsx'

import { colors } from '#universal/styles/tokens.ts'

/**
 * Server-rendered package head (the `community-detail` frame): GitHub-style
 * icon + `@owner / name` + visibility + Repo/Files/Settings tabs, then the
 * public catalog extras (install badges, tags, facts) when a listing exists.
 */

export type CommunityDetailContentProps = {
	listing: PublicCommunityListing | null
	username: string
	kodyId: string
	description: string
	isPrivate: boolean
	ownerProfilePublic: boolean
	loggedIn: boolean
	viewerIsOwner: boolean
	viewerCanManage: boolean
	returnTo: string
	treeRef?: string
	publishCompareHref?: string | null
	hasApp?: boolean
	iconUrl?: string | null
}

export function CommunityDetailContent(props: CommunityDetailContentProps) {
	const {
		listing,
		username,
		kodyId,
		description,
		isPrivate,
		ownerProfilePublic,
		loggedIn,
		viewerIsOwner,
		viewerCanManage,
		returnTo,
		treeRef,
		publishCompareHref,
		hasApp,
		iconUrl,
	} = props
	const packageAppHref = resolvePackageAppHref({
		hasApp: hasApp === true,
		username,
		kodyId,
		viewerIsOwner,
	})
	const markUrl = listing?.iconUrl ?? iconUrl ?? null

	const filesHref = getPackageTreeHref({
		username,
		kodyId,
		listingId: listing?.id,
		ref: listing?.defaultBranch ?? treeRef ?? fallbackDefaultBranchName,
	})

	return (
		<div data-testid="community-detail-frame">
			{renderPackageRepoChrome({
				username,
				kodyId,
				isPrivate,
				isListed: listing != null,
				viewerIsOwner,
				viewerCanManage,
				active: 'repo',
				filesHref,
				description,
				ownerProfilePublic,
				iconUrl: markUrl,
				iconName: listing?.name ?? kodyId,
				animate: true,
				titleActions: listing
					? renderPackageTitleActions({
							viewerIsOwner,
							loggedIn,
							returnTo,
							listingId: listing.id,
							listingName: listing.name,
							ownerUsername: listing.ownerUsername,
							trusted: listing.trusted,
							viewerInstall: listing.viewerInstall ?? null,
						})
					: null,
			})}

			{listing
				? renderListingHead({
						listing,
						loggedIn,
						returnTo,
						viewerIsOwner,
						publishCompareHref,
					})
				: null}

			{packageAppHref ? (
				<div
					data-rise
					style={{ '--rise': '3' } as CSSProperties}
					css={packageAppLinkRowCss}
				>
					<SiteLink
						href={packageAppHref}
						data-testid="open-package-app"
						data-rmx-document
						css={packageAppLinkCss}
					>
						{renderIcon('share', { size: '1em' })}
						Open Package App
					</SiteLink>
				</div>
			) : null}

			{listing ? (
				<>
					<ul
						data-rise
						style={{ '--rise': '3' } as CSSProperties}
						aria-label="Category and tags"
						css={detailTagListCss}
					>
						<li css={communityTagPillCss}>
							<SiteLink
								href={buildCommunityIndexHref({ category: listing.category })}
								data-testid="community-listing-category"
								css={detailCategoryLinkCss}
							>
								{communityPackageCategoryCopy[listing.category].label}
							</SiteLink>
						</li>
						{listing.tags.map((tag) => (
							<li key={tag} css={communityTagPillCss}>
								{tag}
							</li>
						))}
					</ul>

					<dl
						data-rise
						style={{ '--rise': '4' } as CSSProperties}
						css={metaCss}
					>
						{listing.version ? (
							<div>
								<dt>Version</dt>
								<dd data-testid="community-detail-version">
									{listing.version}
								</dd>
							</div>
						) : null}
						<div>
							<dt>License</dt>
							<dd>{listing.license}</dd>
						</div>
						<div>
							<dt>Published</dt>
							<dd>{formatCommunityPublishedDate(listing.publishedAt)}</dd>
						</div>
						<div>
							<dt>Pinned commit</dt>
							<dd>
								<code>{shortCommunityCommit(listing.pinnedCommit)}</code>
							</dd>
						</div>
						<div>
							<dt>Rating</dt>
							<dd data-testid="community-detail-rating">
								{formatCommunityStars(
									listing.averageStars,
									listing.ratingCount,
								)}
							</dd>
						</div>
						<div>
							<dt>Forks</dt>
							<dd data-testid="community-detail-forks">{listing.forkCount}</dd>
						</div>
						<div>
							<dt>Adaptation effort</dt>
							<dd>
								{formatCommunityAdaptationEffort(
									listing.averageAdaptationEffort,
								)}
							</dd>
						</div>
					</dl>
				</>
			) : null}
		</div>
	)
}

function renderListingHead(input: {
	listing: PublicCommunityListing
	loggedIn: boolean
	returnTo: string
	viewerIsOwner: boolean
	publishCompareHref?: string | null
}) {
	const viewerBadge = renderCommunityViewerInstallBadge({
		listing: input.listing,
		variant: 'detail',
		loggedIn: input.loggedIn,
		returnTo: input.returnTo,
		viewerIsOwner: input.viewerIsOwner,
	})
	if (!input.listing.sourceAhead && !input.listing.featured && !viewerBadge) {
		return null
	}
	return (
		<header
			data-rise
			style={{ '--rise': '2' } as CSSProperties}
			css={listingHeadCss}
		>
			<div css={listingBadgeGroupCss}>
				{input.listing.sourceAhead ? (
					input.publishCompareHref ? (
						<SiteLink
							href={input.publishCompareHref}
							data-testid="community-detail-source-ahead-badge"
							title="Review the unpublished HEAD changes, then publish them."
							css={badgeLinkCss}
						>
							HEAD ahead of published
						</SiteLink>
					) : (
						<span
							data-testid="community-detail-source-ahead-badge"
							title="Default-branch HEAD is newer than the last package publish. Source at HEAD is already public; runtime still uses the published commit."
							css={badgeCss}
						>
							HEAD ahead of published
						</span>
					)
				) : null}
				{input.listing.featured ? (
					<span
						data-testid="community-detail-featured-badge"
						title="An admin featured this package as an onboarding starter install."
						css={badgeCss}
					>
						Featured
					</span>
				) : null}
				{viewerBadge}
			</div>
		</header>
	)
}

const listingHeadCss = {
	marginTop: '1.4rem',
	display: 'flex',
	alignItems: 'flex-start',
	gap: '1.1rem',
} satisfies CSSObject

const listingBadgeGroupCss = {
	display: 'flex',
	alignItems: 'center',
	flexWrap: 'wrap' as const,
	gap: '0.35rem',
} satisfies CSSObject

const badgeCss = {
	display: 'inline-flex',
	alignItems: 'center',
	padding: '0.15rem 0.55rem',
	borderRadius: '999px',
	fontSize: '0.78rem',
	fontWeight: 600,
	backgroundColor: colors.surface,
	border: `1px solid ${colors.border}`,
	color: colors.textMuted,
} satisfies CSSObject

const badgeLinkCss = {
	...badgeCss,
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
		borderColor: colors.textMuted,
	},
} satisfies CSSObject

function resolvePackageAppHref(input: {
	hasApp: boolean
	username: string
	kodyId: string
	viewerIsOwner: boolean
}) {
	if (!input.hasApp || !input.viewerIsOwner) return null
	return buildPackageAppPath({
		username: input.username,
		kodyId: input.kodyId,
	})
}

const packageAppLinkRowCss = {
	display: 'flex',
	flexWrap: 'wrap' as const,
	alignItems: 'center',
	gap: '0.65rem 1.15rem',
	margin: '0.9rem 0 0',
} satisfies CSSObject

const packageAppLinkCss = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.35rem',
	color: colors.primaryText,
	fontWeight: 550,
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
	},
} satisfies CSSObject

const detailTagListCss = {
	...communityTagListCss,
	marginTop: '1rem',
} satisfies CSSObject

const detailCategoryLinkCss = {
	color: colors.primaryText,
	fontWeight: 550,
	textDecoration: 'underline',
	textUnderlineOffset: '0.18em',
	'&:hover': {
		color: colors.text,
	},
} satisfies CSSObject

const metaCss = {
	margin: '1.6rem 0 0',
	padding: '1rem 0',
	borderBlock: `1px solid ${colors.border}`,
	display: 'flex',
	flexWrap: 'wrap' as const,
	gap: '0.5rem 2rem',
	fontSize: '0.92rem',
	'& > div': {
		display: 'flex',
		gap: '0.45rem',
		alignItems: 'baseline',
	},
	'& dt': {
		margin: 0,
		color: colors.textMuted,
	},
	'& dd': {
		margin: 0,
		color: colors.text,
		fontWeight: 550,
	},
	'& dd code': {
		font: '500 0.88rem/1.2 ui-monospace, "SF Mono", Menlo, monospace',
	},
} satisfies CSSObject

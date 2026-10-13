/** @jsxImportSource @emotion/react */
import { SiteLink } from './site-link.tsx'
/** @jsxRuntime automatic */
import { type CSSObject } from '@emotion/react'
import { type CSSProperties, type ReactNode } from 'react'
import { IdentityIconMark } from './identity-icon-mark.tsx'
import { getPackageSettingsHref } from '#universal/package-files.ts'
import { renderPackageStatusSignifiers } from './package-status-signifiers.tsx'
import { routes } from '#universal/routes.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'

export type PackageRepoNavActive = 'repo' | 'files' | 'settings'

function renderPackageRepoNav(input: {
	username: string
	kodyId: string
	filesHref: string
	viewerCanManage: boolean
	/** Defaults to true. Pass false only to hide Files intentionally. */
	showFilesNav?: boolean
	active: PackageRepoNavActive
}) {
	const repoHref = routes.communityPackage.href({
		username: input.username,
		kodyId: input.kodyId,
	})
	const settingsHref = getPackageSettingsHref({
		username: input.username,
		kodyId: input.kodyId,
	})
	const showFilesNav = input.showFilesNav !== false
	return (
		<nav aria-label="Repository" data-testid="package-repo-nav" css={navCss}>
			<SiteLink
				href={repoHref}
				aria-current={input.active === 'repo' ? 'page' : undefined}
				data-testid="package-repo-nav-repo"
				css={tabCss}
			>
				Repo
			</SiteLink>
			{showFilesNav ? (
				<SiteLink
					href={input.filesHref}
					aria-current={input.active === 'files' ? 'page' : undefined}
					data-testid="package-repo-nav-files"
					css={tabCss}
				>
					Files
				</SiteLink>
			) : null}

			{input.viewerCanManage ? (
				<SiteLink
					href={settingsHref}
					aria-current={input.active === 'settings' ? 'page' : undefined}
					data-testid="package-repo-nav-settings"
					css={tabCss}
				>
					Settings
				</SiteLink>
			) : null}
		</nav>
	)
}

export function renderPackageRepoChrome(input: {
	username: string
	kodyId: string
	isPrivate: boolean
	isListed?: boolean
	/** Defaults to true (saved package). Plain repos pass false. */
	hasPackage?: boolean
	viewerIsOwner: boolean
	viewerCanManage: boolean
	active: PackageRepoNavActive
	filesHref: string
	description?: string
	ownerProfilePublic?: boolean
	iconUrl?: string | null
	iconName?: string
	iconTestId?: string
	animate?: boolean
	titleActions?: ReactNode
}) {
	const backHref = input.viewerIsOwner
		? routes.profile.href({ username: input.username })
		: routes.community.href()
	const backLabel = input.viewerIsOwner
		? `@${input.username}`
		: 'Public packages'
	const profileHref =
		input.ownerProfilePublic === false
			? null
			: routes.profile.href({ username: input.username })
	const rise = (step: string) =>
		input.animate
			? ({
					'data-rise': true,
					style: { '--rise': step } as CSSProperties & { '--rise': string },
				} as const)
			: {}
	const isListed = input.isListed === true
	const hasPackage = input.hasPackage !== false

	return (
		<div data-testid="package-repo-chrome">
			<SiteLink
				{...rise('0')}
				href={backHref}
				data-testid="package-repo-back"
				css={backLinkCss}
			>
				← {backLabel}
			</SiteLink>
			<header {...rise('1')} css={headCss}>
				<IdentityIconMark
					name={input.iconName ?? input.kodyId}
					iconUrl={input.iconUrl ?? null}
					size="detail"
					testId={
						input.iconTestId ??
						(isListed
							? 'community-listing-icon-detail'
							: 'package-identity-icon-detail')
					}
				/>
				<h1 css={titleCss}>
					{profileHref ? (
						<SiteLink href={profileHref} css={ownerLinkCss}>
							@{input.username}
						</SiteLink>
					) : (
						<span data-testid="community-detail-owner-private">
							@{input.username}
						</span>
					)}
					<span css={slashCss}>/</span>
					<span data-testid="package-title-name" css={titleNameCss}>
						<span css={titleLeafCss}>{input.kodyId}</span>
						{input.titleActions}
						{renderPackageStatusSignifiers({
							isPrivate: input.isPrivate,
							isListed,
							hasPackage,
						})}
					</span>
				</h1>
			</header>
			{input.description ? (
				<p {...rise('2')} css={descriptionCss}>
					{input.description}
				</p>
			) : null}
			<div {...rise('3')}>
				{renderPackageRepoNav({
					username: input.username,
					kodyId: input.kodyId,
					filesHref: input.filesHref,
					viewerCanManage: input.viewerCanManage,
					active: input.active,
				})}
			</div>
		</div>
	)
}

const backLinkCss = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.4rem',
	fontSize: '0.95rem',
	fontWeight: 550,
	color: colors.primaryText,
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
	},
} satisfies CSSObject

const headCss = {
	marginTop: '1.8rem',
	display: 'flex',
	alignItems: 'center',
	gap: '0.85rem',
	minWidth: 0,
} satisfies CSSObject

const titleCss = {
	margin: 0,
	display: 'flex',
	alignItems: 'center',
	flexWrap: 'wrap' as const,
	gap: '0.45rem',
	fontSize: 'clamp(1.5rem, 3.6vw, 2rem)',
	fontWeight: 760,
	letterSpacing: '-0.024em',
	lineHeight: 1.15,
	overflowWrap: 'anywhere' as const,
	minWidth: 0,
} satisfies CSSObject

// Keep the leaf name with its status icons. A wrap between them parks the
// verify/fork control on the package mark, where it reads as a badge.
const titleNameCss = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.75rem',
	flexWrap: 'nowrap' as const,
	minWidth: 0,
	maxWidth: '100%',
} satisfies CSSObject

const titleLeafCss = {
	minWidth: 0,
	overflowWrap: 'anywhere' as const,
} satisfies CSSObject

const slashCss = {
	color: colors.textMuted,
	fontWeight: 500,
} satisfies CSSObject

const ownerLinkCss = {
	color: colors.text,
	fontWeight: 550,
	textDecoration: 'none',
	'&:hover': {
		color: colors.primaryText,
	},
} satisfies CSSObject

const descriptionCss = {
	margin: '1rem 0 0',
	color: colors.textMuted,
	fontSize: '1.05rem',
	maxWidth: '58ch',
} satisfies CSSObject

const navCss = {
	display: 'flex',
	alignItems: 'center',
	gap: spacing.sm,
	marginTop: '1.1rem',
} satisfies CSSObject

const tabCss = {
	display: 'inline-flex',
	alignItems: 'center',
	padding: '0.55rem 0.15rem',
	borderBottom: '2px solid transparent',
	color: colors.textMuted,
	fontSize: '0.95rem',
	fontWeight: 550,
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
	},
	'&[aria-current="page"]': {
		color: colors.text,
		borderBottomColor: colors.primary,
	},
} satisfies CSSObject

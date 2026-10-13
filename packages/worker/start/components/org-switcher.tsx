/** @jsxImportSource @emotion/react */
import {
	useState,
	useEffect,
	type ReactNode,
	type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useLocation } from '@tanstack/react-router'
import { workspaceSwitchHref } from '#client/routes/account-rail.ts'
import { SiteLink } from './site-link.tsx'
import { type IconName, renderIcon } from './icon.tsx'
import { UserAvatar } from './user-avatar.tsx'
import {
	currentSwitcherSlug,
	orgIdentity,
	orgRoleLabel,
	orgSwitcherEntries,
	organizationsWithSignupFallback,
	type OrganizationSummary,
	type OrgSwitcherEntry,
} from '#universal/org-pages.ts'
import { routes } from '#universal/routes.ts'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from '#universal/styles/tokens.ts'
import {
	hoverMq,
	layoutMaxWidths,
	pageGutter,
} from '#universal/styles/style-primitives.ts'

const orgSwitcherPanelId = 'org-switcher'
const headerNavMq = '@media (max-width: 820px)'
type SwitcherRow = {
	key: string
	href: string
	label: string
	detail: string | null
	ariaCurrent: 'true' | 'page' | undefined
	/** The organization the header is acting in; drawn with a check. */
	selected: boolean
	leading: ReactNode
	badge: string | null
}

function renderSwitcherRow(row: SwitcherRow) {
	return (
		<SiteLink
			key={row.key}
			href={row.href}
			aria-current={row.ariaCurrent}
			data-testid={`org-switcher-${row.key}`}
			data-selected={row.selected ? '' : undefined}
			css={switcherRowCss}
		>
			<span css={switcherLeadingCss}>{row.leading}</span>
			<span css={switcherRowTextCss}>
				<span css={switcherRowLabelCss}>{row.label}</span>
				{row.detail ? (
					<span css={switcherRowDetailCss}>{row.detail}</span>
				) : null}
			</span>
			{row.badge ? <span css={switcherCountCss}>{row.badge}</span> : null}
			{row.selected ? (
				<span css={switcherCheckCss}>
					{renderIcon('check', { size: '1.1rem' })}
				</span>
			) : null}
		</SiteLink>
	)
}

function renderIconWell(name: IconName) {
	return (
		<span aria-hidden="true" css={switcherIconWellCss}>
			{renderIcon(name, { size: '1rem' })}
		</span>
	)
}

function renderLogoutRow() {
	return (
		<form
			key="logout"
			method="post"
			action={routes.logout.href()}
			css={{ margin: 0, display: 'grid' }}
		>
			<button
				type="submit"
				data-testid="org-switcher-logout"
				css={switcherButtonRowCss}
			>
				<span css={switcherLeadingCss}>{renderIconWell('lock')}</span>
				<span css={switcherRowTextCss}>
					<span css={switcherRowLabelCss}>Log out</span>
				</span>
			</button>
		</form>
	)
}

/** Focus order for the arrow keys: the trigger, then every row in the panel. */
function moveSwitcherFocus(
	event: ReactKeyboardEvent,
	panel: HTMLElement | null,
) {
	if (!panel || !panel.matches(':popover-open')) return
	const rows = Array.from(
		panel.querySelectorAll<HTMLElement>('a[href], button'),
	)
	if (rows.length === 0) return
	const index = rows.findIndex((row) => row === document.activeElement)
	const next =
		event.key === 'ArrowDown'
			? rows[(index + 1) % rows.length]
			: event.key === 'ArrowUp'
				? rows[index <= 0 ? rows.length - 1 : index - 1]
				: event.key === 'Home'
					? rows[0]
					: event.key === 'End'
						? rows[rows.length - 1]
						: null
	if (!next) return
	event.preventDefault()
	next.focus()
}

export function OrgSwitcher({
	session,
	displayName,
	avatarUrl,
	menu = false,
}: {
	session: {
		organizations: Array<OrganizationSummary>
		inviteCount: number
		lastUsedOrganization: string | null
		username: string
	}
	displayName: string
	avatarUrl: string | null
	menu?: boolean
}) {
	const pathname = useLocation({ select: (location) => location.pathname })
	const href = useLocation({ select: (location) => location.href })
	const props = {
		...session,
		displayName,
		avatarUrl,
		menu,
		currentPathname: pathname,
	}
	const [open, setOpen] = useState(false)
	useEffect(() => {
		const panel = document.getElementById(orgSwitcherPanelId)
		if (panel?.matches(':popover-open')) panel.hidePopover()
	}, [href])
	function onToggle(event: { newState?: string }) {
		setOpen(event.newState === 'open')
	}

	const organizations = organizationsWithSignupFallback({
		organizations: props.organizations,
		username: props.username,
	})
	if (organizations.length === 0) return null
	const viewer = {
		displayName: props.displayName,
		avatarUrl: props.avatarUrl,
	}
	const entries = orgSwitcherEntries(organizations, props.inviteCount)
	const currentSlug = currentSwitcherSlug({
		pathname: props.currentPathname,
		organizations,
		lastUsedSlug: props.lastUsedOrganization,
	})
	const listedCurrent = organizations.find((org) => org.slug === currentSlug)
	// Stale session lists can omit the URL org on `/@slug/-/…`. Synthesize
	// a member-shaped row for the trigger label and a dedicated switcher
	// entry — do not invent Owner (Billing) links.
	const synthesizedCurrent =
		listedCurrent || !currentSlug
			? null
			: {
					slug: currentSlug,
					displayName: null,
					role: 'member' as const,
					personal: currentSlug === props.username,
				}
	const current = listedCurrent ?? synthesizedCurrent ?? undefined
	const currentIdentity = current ? orgIdentity(current, viewer) : null
	const label = currentIdentity?.handle ?? 'Organizations'
	const avatarSize = props.menu ? 32 : 28
	const toRow = (entry: OrgSwitcherEntry): SwitcherRow => {
		switch (entry.kind) {
			case 'create':
				return {
					key: 'create',
					href: routes.accountOrganizationsNew.href(),
					label: 'Create organization',
					detail: null,
					ariaCurrent:
						props.currentPathname === routes.accountOrganizationsNew.href()
							? 'page'
							: undefined,
					selected: false,
					leading: renderIconWell('plus'),
					badge: null,
				}
			case 'invites':
				return {
					key: 'invites',
					href: `${routes.accountOrganizations.href()}#invites`,
					label: 'Invites',
					detail: null,
					ariaCurrent: undefined,
					selected: false,
					leading: renderIconWell('mail'),
					badge: entry.count > 0 ? String(entry.count) : null,
				}
			case 'org': {
				const identity = orgIdentity(entry.org, viewer)
				const role = entry.showRole ? orgRoleLabel(entry.org.role) : null
				const selected = entry.org.slug === currentSlug
				return {
					key: entry.org.slug,
					href: workspaceSwitchHref(props.currentPathname, entry.org),
					label: identity.name,
					detail: identity.hasName
						? [identity.handle, role].filter(Boolean).join(' · ')
						: role,
					ariaCurrent: selected ? 'true' : undefined,
					selected,
					leading: (
						<UserAvatar
							displayName={identity.avatarName}
							avatarUrl={identity.avatarUrl}
							size={avatarSize}
							variant="well"
						/>
					),
					badge: null,
				}
			}
			default: {
				const exhaustive: never = entry
				return exhaustive
			}
		}
	}
	const orgRowsFromSession = entries
		.filter((entry) => entry.kind === 'org')
		.map(toRow)
	// Dedicated row when the URL org is missing from the session list so
	// the person can still see and re-select it in the switcher.
	const orgRows =
		synthesizedCurrent !== null
			? [
					toRow({
						kind: 'org',
						org: synthesizedCurrent,
						showRole: true,
					}),
					...orgRowsFromSession,
				]
			: orgRowsFromSession
	const actionRows = entries.filter((entry) => entry.kind !== 'org').map(toRow)

	const body = (
		<>
			<p css={switcherEyebrowCss}>Organizations</p>
			<ul aria-label="Organizations" css={switcherListCss}>
				{orgRows.map((row) => (
					<li key={row.key}>{renderSwitcherRow(row)}</li>
				))}
			</ul>
			{actionRows.length > 0 ? (
				<div css={switcherActionsCss}>{actionRows.map(renderSwitcherRow)}</div>
			) : null}
		</>
	)

	if (props.menu) {
		return (
			<div
				data-menu-group
				data-testid="org-switcher-menu"
				css={switcherMenuGroupCss}
			>
				{body}
				{renderAccountGroup({
					username: props.username,
					currentPathname: props.currentPathname,
					heading: true,
				})}
			</div>
		)
	}

	return (
		<div
			css={orgSwitcherCss}
			onKeyDown={(event) =>
				moveSwitcherFocus(event, document.getElementById(orgSwitcherPanelId))
			}
		>
			<button
				type="button"
				popoverTarget={orgSwitcherPanelId}
				aria-controls={orgSwitcherPanelId}
				aria-label={`${label}: switch organization`}
				aria-expanded={open ? 'true' : 'false'}
				data-open={open ? '' : undefined}
				data-testid="org-switcher"
				css={orgSwitcherButtonCss}
			>
				<UserAvatar
					displayName={currentIdentity?.avatarName ?? label}
					avatarUrl={currentIdentity?.avatarUrl ?? null}
					size={26}
					variant="well"
				/>
				<span css={orgSwitcherLabelCss}>{label}</span>
				<span aria-hidden="true" css={orgSwitcherChevronCss}>
					{renderIcon('chevron-down', { size: '1rem' })}
				</span>
			</button>
			<div
				id={orgSwitcherPanelId}
				popover="auto"
				data-testid="org-switcher-panel"
				css={orgSwitcherPanelCss}
				onToggle={(event) => onToggle(event.nativeEvent)}
			>
				{body}
			</div>
		</div>
	)
}
function accountRows(input: {
	username: string
	currentPathname: string
}): Array<SwitcherRow> {
	const pageCurrent = (href: string) =>
		input.currentPathname === href ? ('page' as const) : undefined
	const row = (
		key: string,
		href: string,
		label: string,
		icon: IconName,
	): SwitcherRow => ({
		key,
		href,
		label,
		detail: null,
		ariaCurrent: pageCurrent(href),
		selected: false,
		leading: renderIconWell(icon),
		badge: null,
	})
	return [
		...(input.username
			? [
					row(
						'account-profile',
						routes.profile.href({ username: input.username }),
						'Your profile',
						'globe',
					),
				]
			: []),
		row('account-settings', routes.account.href(), 'Account settings', 'user'),
		row(
			'account-usage',
			routes.accountUsage.href(),
			'Usage & credits',
			'chart',
		),
	]
}

function renderAccountGroup(input: {
	username: string
	currentPathname: string
	heading: boolean
}) {
	return (
		<div
			role="group"
			aria-label="Your account"
			data-testid="org-switcher-account-group"
			css={input.heading ? switcherActionsCss : switcherAccountListCss}
		>
			{input.heading ? <p css={switcherEyebrowCss}>Your account</p> : null}
			{accountRows(input).map(renderSwitcherRow)}
			{renderLogoutRow()}
		</div>
	)
}

export function AccountMenu(props: {
	username: string
	displayName: string
	avatarUrl: string | null
}) {
	const [open, setOpen] = useState(false)
	const href = useLocation({ select: (location) => location.href })
	const pathname = useLocation({ select: (location) => location.pathname })
	useEffect(() => {
		const panel = document.getElementById(accountMenuPanelId)
		if (panel?.matches(':popover-open')) panel.hidePopover()
	}, [href])
	const name = props.displayName.trim() || props.username
	return (
		<div
			css={orgSwitcherCss}
			onKeyDown={(event) =>
				moveSwitcherFocus(event, document.getElementById(accountMenuPanelId))
			}
		>
			<button
				type="button"
				popoverTarget={accountMenuPanelId}
				aria-controls={accountMenuPanelId}
				aria-label={`${name}: your account`}
				aria-expanded={open ? 'true' : 'false'}
				data-open={open ? '' : undefined}
				data-testid="account-menu"
				css={accountMenuButtonCss}
			>
				<UserAvatar
					displayName={name}
					avatarUrl={props.avatarUrl}
					size={34}
					variant="well"
				/>
			</button>
			<div
				id={accountMenuPanelId}
				popover="auto"
				data-testid="account-menu-panel"
				css={accountMenuPanelCss}
				onToggle={(event) => setOpen(event.nativeEvent.newState === 'open')}
			>
				<div css={accountMenuIdentityCss}>
					<span css={switcherRowLabelCss}>{name}</span>
					{props.username ? (
						<span css={switcherRowDetailCss}>{`@${props.username}`}</span>
					) : null}
				</div>
				{renderAccountGroup({
					username: props.username,
					currentPathname: pathname,
					heading: false,
				})}
			</div>
		</div>
	)
}
const accountMenuPanelId = 'account-menu'
const menuGroupDividerCss = {
	'[data-menu-group] + &': {
		marginTop: '0.35rem',
		paddingTop: '0.5rem',
		borderTop: `1px solid ${colors.border}`,
	},
}

const orgSwitcherAnchor = '--org-switcher'

const orgSwitcherCss = {
	position: 'relative' as const,
}

const orgSwitcherButtonCss = {
	anchorName: orgSwitcherAnchor,
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.45rem',
	minHeight: '44px',
	padding: '0.2rem 0.6rem 0.2rem 0.2rem',
	borderRadius: radius.full,
	border: `1.5px solid ${colors.border}`,
	background: 'transparent',
	color: colors.text,
	// Buttons do not inherit the page face on their own.
	font: `600 0.95rem/1 ${typography.fontFamily}`,
	cursor: 'pointer',
	transition: `border-color ${transitions.fast}, background-color ${transitions.fast}`,
	'&[data-open]': {
		borderColor: colors.textMuted,
		backgroundColor: colors.surface,
	},
	[hoverMq]: {
		'&:hover': { borderColor: colors.textMuted },
	},
}

const orgSwitcherLabelCss = {
	maxWidth: '14rem',
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap' as const,
}

const orgSwitcherChevronCss = {
	display: 'inline-flex',
	color: colors.textMuted,
	transition: `rotate 180ms ${transitions.easeOut}`,
	'[data-open] > &': { rotate: '180deg' },
	'@media (prefers-reduced-motion: reduce)': { transition: 'none' },
}

/**
 * Hangs under the trigger with its inline end against the trigger's, so the
 * menu grows into the header instead of past the header's right edge. The
 * nav is a centered 72rem column, and a viewport gutter alone sits outside
 * that column on a 1440px desktop. Anchor positioning pins the end to the
 * trigger and flips when the trigger is against the start edge. Without it,
 * the same inset is the header content's inline end. Native popover, like
 * the site menu: top layer, light dismiss, Escape, and focus return come
 * from the platform.
 */
const headerContentEndInset = `max(${pageGutter}, calc((100% - ${layoutMaxWidths.extended}) / 2 + ${pageGutter}))`

const orgSwitcherPanelCss = {
	position: 'fixed' as const,
	inset: 'auto' as const,
	top: '4.15rem',
	right: headerContentEndInset,
	width: 'min(20rem, calc(100vw - 2rem))',
	maxHeight: 'calc(100dvh - 6rem)',
	overflowY: 'auto' as const,
	margin: 0,
	padding: '0.5rem',
	boxSizing: 'border-box' as const,
	border: `1.5px solid ${colors.border}`,
	borderRadius: '18px',
	backgroundColor: colors.surface,
	boxShadow: shadows.md,
	color: colors.text,
	'@supports (anchor-name: --a)': {
		positionAnchor: orgSwitcherAnchor,
		top: 'anchor(bottom)',
		right: 'anchor(right)',
		left: 'auto',
		marginTop: '0.5rem',
		positionTryFallbacks: 'flip-inline',
	},
	opacity: 0,
	translate: '0 -6px',
	transformOrigin: 'top right',
	transition: `opacity 160ms ${transitions.easeOut}, translate 160ms ${transitions.easeOut}, display 160ms allow-discrete, overlay 160ms allow-discrete`,
	'&:popover-open': {
		display: 'grid',
		opacity: 1,
		translate: '0 0',
		'@starting-style': { opacity: 0, translate: '0 -6px' },
	},
	'@media (prefers-reduced-motion: reduce)': {
		translate: 'none',
		transition: `opacity 120ms ${transitions.easeOut}, display 120ms allow-discrete, overlay 120ms allow-discrete`,
	},
}

const switcherEyebrowCss = {
	margin: 0,
	padding: '0.35rem 0.6rem 0.3rem',
	[headerNavMq]: { paddingInline: '0.85rem' },
	fontSize: typography.fontSize.xs,
	fontWeight: 650,
	letterSpacing: '0.06em',
	textTransform: 'uppercase' as const,
	color: colors.textMuted,
}

const switcherListCss = {
	display: 'grid',
	gap: '0.15rem',
	listStyle: 'none',
	margin: 0,
	padding: 0,
}

const switcherActionsCss = {
	display: 'grid',
	gap: '0.15rem',
	marginTop: '0.35rem',
	paddingTop: '0.4rem',
	borderTop: `1px solid ${colors.border}`,
}

/** Mobile menu: the same rows as one of the menu panel's groups. */
const switcherMenuGroupCss = {
	display: 'grid',
	...menuGroupDividerCss,
}

const switcherRowCss = {
	display: 'flex',
	alignItems: 'center',
	gap: '0.7rem',
	minHeight: '44px',
	padding: '0.4rem 0.6rem',
	[headerNavMq]: { paddingInline: '0.85rem' },
	boxSizing: 'border-box' as const,
	borderRadius: '12px',
	color: colors.text,
	textDecoration: 'none',
	transition: `background-color ${transitions.fast}`,
	'&[aria-current="page"]': { backgroundColor: colors.primarySoft },
	'&:active': { backgroundColor: colors.primarySoftest },
	[hoverMq]: {
		'&:hover': { backgroundColor: colors.primarySoftest, color: colors.text },
	},
}

const switcherButtonRowCss = {
	...switcherRowCss,
	width: '100%',
	border: 'none',
	background: 'transparent',
	font: 'inherit',
	textAlign: 'start' as const,
	cursor: 'pointer',
}

const switcherLeadingCss = {
	display: 'inline-flex',
	flexShrink: 0,
	lineHeight: 0,
}

const switcherIconWellCss = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '28px',
	height: '28px',
	boxSizing: 'border-box' as const,
	borderRadius: radius.full,
	border: `1px dashed ${colors.border}`,
	color: colors.textMuted,
	[headerNavMq]: { width: '32px', height: '32px' },
}

const switcherRowTextCss = {
	display: 'grid',
	gap: '0.1rem',
	minWidth: 0,
	flex: '1 1 auto',
}

const switcherRowLabelCss = {
	fontWeight: 600,
	fontSize: '0.95rem',
	lineHeight: 1.25,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap' as const,
	[headerNavMq]: { fontSize: '1rem' },
}

const switcherRowDetailCss = {
	fontSize: typography.fontSize.sm,
	lineHeight: 1.25,
	color: colors.textMuted,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap' as const,
}

const switcherCountCss = {
	flexShrink: 0,
	minWidth: '1.4rem',
	padding: '0.1rem 0.45rem',
	boxSizing: 'border-box' as const,
	borderRadius: radius.full,
	backgroundColor: colors.primary,
	color: colors.onPrimary,
	fontSize: typography.fontSize.xs,
	fontWeight: 700,
	textAlign: 'center' as const,
	fontVariantNumeric: 'tabular-nums',
}

const switcherCheckCss = {
	display: 'inline-flex',
	flexShrink: 0,
	color: colors.primaryText,
}

const accountMenuAnchor = '--account-menu'

const accountMenuButtonCss = {
	anchorName: accountMenuAnchor,
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '44px',
	height: '44px',
	padding: 0,
	borderRadius: radius.full,
	border: `1.5px solid ${colors.border}`,
	background: 'transparent',
	cursor: 'pointer',
	transition: `border-color ${transitions.fast}`,
	'&[data-open]': { borderColor: colors.textMuted },
	[hoverMq]: {
		'&:hover': { borderColor: colors.textMuted },
	},
}

const accountMenuIdentityCss = {
	display: 'grid',
	gap: '0.15rem',
	padding: '0.5rem 0.6rem 0.6rem',
	borderBottom: `1px solid ${colors.border}`,
	minWidth: 0,
}

const switcherAccountListCss = {
	display: 'grid',
	gap: '0.1rem',
	paddingTop: '0.35rem',
}

const accountMenuPanelCss = {
	...orgSwitcherPanelCss,
	width: 'min(16rem, calc(100vw - 2rem))',
	'@supports (anchor-name: --a)': {
		...orgSwitcherPanelCss['@supports (anchor-name: --a)'],
		positionAnchor: accountMenuAnchor,
	},
}

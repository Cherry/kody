/** @jsxImportSource @emotion/react */
import { SiteLink } from './site-link.tsx'
/** @jsxRuntime automatic */
import { type CSSObject } from '@emotion/react'
import {
	type ReactNode,
	createContext,
	useContext,
	useState,
	useRef,
	useEffect,
} from 'react'
import { writeClipboardText } from '#client/clipboard.ts'
import { type ViewerListingInstall } from '#universal/community-public-types.ts'
import { getCommunityPackageHrefFromName } from '#universal/community-links.ts'
import {
	FORK_OUTDATED_COPY_TOOLTIP,
	copyPromptTooltipCss,
} from './fork-outdated-copy-button.tsx'
import { renderIcon, type IconName } from './icon.tsx'
import { routes } from '#universal/routes.ts'
import {
	inlineSpinnerCss,
	visuallyHiddenCss,
} from '#universal/styles/style-primitives.ts'
import { colors } from '#universal/styles/tokens.ts'
const OTHER_ACCOUNT_FORK_TOOLTIP =
	'This was built by another user. Verify it before using. Click again to confirm fork.'
const FORK_TITLE_TOOLTIP = 'Fork'
const OPEN_FORK_TOOLTIP = 'Open fork'
const COPY_SETUP_PROMPT_TOOLTIP = 'Copy setup prompt'

const titleIconSize = '1.15em'
const statusTooltipId = 'package-title-status-tooltip'
const copyTooltipId = 'package-title-copy-tooltip'

type PackageTitleActionsInput = {
	viewerIsOwner: boolean
	loggedIn: boolean
	returnTo: string
	listingId: string
	listingName: string
	ownerUsername: string
	trusted: boolean
	viewerInstall: ViewerListingInstall | null
}

/**
 * One status control beside the package name, plus a clipboard when a setup
 * prompt exists. Steady states are static frame HTML; the install spinner is
 * revealed on the same fork/verify control.
 */
export function renderPackageTitleActions(input: PackageTitleActionsInput) {
	if (input.viewerIsOwner) return null
	const status = renderStatusControl(input)
	const clipboard = renderSetupPromptControl(input.viewerInstall)
	if (!status && !clipboard) return null
	return (
		<span data-testid="package-title-actions" css={titleActionsCss}>
			{status}
			{clipboard}
		</span>
	)
}

function renderStatusControl(input: PackageTitleActionsInput) {
	const install = input.viewerInstall
	if (install?.listingAhead && install.listingAheadPrompt) {
		return renderOutdatedControl(install)
	}
	if (install) {
		const href =
			getCommunityPackageHrefFromName(install.targetName) ?? '/account/packages'
		return renderIconControl({
			href,
			status: 'open',
			icon: 'arrow-up-right',
			label: OPEN_FORK_TOOLTIP,
			tooltip: OPEN_FORK_TOOLTIP,
			testId: 'package-title-status',
		})
	}
	const loginHref = routes.login.href(null, {
		searchParams: { redirectTo: input.returnTo || routes.community.href() },
	})

	return renderInstallControl({
		icon: 'git-fork',
		label: FORK_TITLE_TOOLTIP,
		tooltip: OTHER_ACCOUNT_FORK_TOOLTIP,
		loggedIn: input.loggedIn,
		loginHref,
		trusted: input.trusted,
		listingId: input.listingId,
	})
}

function renderSetupPromptControl(
	install: ViewerListingInstall | null,
): ReactNode {
	if (!install || install.listingAhead) return null
	if (install.status !== 'adaptation_required') return null
	const prompt = install.agentPrompt.trim()
	if (!prompt) return null
	return renderIconControl({
		status: null,
		icon: 'clipboard',
		label: COPY_SETUP_PROMPT_TOOLTIP,
		tooltip: COPY_SETUP_PROMPT_TOOLTIP,
		testId: 'package-title-copy-setup',
		copyText: prompt,
	})
}

function renderOutdatedControl(install: ViewerListingInstall) {
	const prompt = install.listingAheadPrompt ?? ''
	return renderIconControl({
		href: install.listingDiffHref,
		status: 'outdated',
		icon: 'link-break',
		label: 'Fork outdated',
		tooltip: FORK_OUTDATED_COPY_TOOLTIP,
		testId: 'package-title-status',
		copyText: prompt,
		outdated: true,
	})
}

export const PackageInstallContext = createContext({
	busy: false,
	confirmed: false,
	onInstall: () => {},
	onDisarm: () => {},
})
function renderInstallControl(input: {
	icon: IconName
	label: string
	tooltip: string
	loggedIn: boolean
	loginHref: string
	trusted: boolean
	listingId: string
}) {
	return <InstallControl input={input} />
}
function InstallControl({
	input,
}: {
	input: {
		icon: IconName
		label: string
		tooltip: string
		loggedIn: boolean
		loginHref: string
		trusted: boolean
		listingId: string
	}
}) {
	const install = useContext(PackageInstallContext)
	const label = install.busy
		? 'Installing'
		: install.confirmed
			? 'Confirm fork'
			: input.label

	const shared = {
		'data-testid': 'community-detail-install',
		'data-package-title-status': 'verify',
		'data-package-title-idle': 'verify',
		'data-package-title-listing': input.listingId,
		'data-title-idle-label': input.label,
		'data-title-idle-tooltip': input.tooltip,
		'data-community-install': '',
		'data-trusted': input.trusted ? 'true' : 'false',
		'aria-label': label,
		'aria-describedby': statusTooltipId,
	}
	const children = (
		<>
			<span data-title-status-icon hidden={install.busy}>
				{renderIcon(input.icon, { size: titleIconSize })}
			</span>
			<span
				data-title-status-spinner
				hidden={!install.busy}
				css={titleSpinnerCss}
			/>
			<span
				id={statusTooltipId}
				role="tooltip"
				data-title-status-tooltip
				aria-hidden="true"
			>
				{input.tooltip}
			</span>
			<span data-title-status-live aria-live="polite" css={visuallyHiddenCss} />
		</>
	)
	if (!input.loggedIn) {
		return (
			<SiteLink href={input.loginHref} {...shared} css={titleActionCss}>
				{children}
			</SiteLink>
		)
	}
	return (
		<button
			type="button"
			{...shared}
			css={titleActionCss}
			disabled={install.busy}
			onClick={install.onInstall}
			onBlur={install.onDisarm}
		>
			{children}
		</button>
	)
}

function renderIconControl(input: {
	href?: string | null
	status: 'open' | 'outdated' | null
	icon: IconName
	label: string
	tooltip: string
	testId: string
	copyText?: string
	outdated?: boolean
}) {
	return <IconControl input={input} />
}
function IconControl({
	input,
}: {
	input: {
		href?: string | null
		status: 'open' | 'outdated' | null
		icon: IconName
		label: string
		tooltip: string
		testId: string
		copyText?: string
		outdated?: boolean
	}
}) {
	const [feedback, setFeedback] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			if (timer.current) clearTimeout(timer.current)
		}
	}, [])
	async function copy(event: React.MouseEvent) {
		if (!input.copyText) return
		event.preventDefault()
		let text = 'Copied'
		try {
			await writeClipboardText(input.copyText)
		} catch {
			text = 'Copy failed'
		}
		if (!mounted.current) return
		setFeedback(text)
		if (timer.current) clearTimeout(timer.current)
		timer.current = setTimeout(() => setFeedback(null), 2000)
	}

	const tooltipId = input.copyText ? copyTooltipId : statusTooltipId
	const copyAttrs = input.copyText
		? {
				'data-copy-prompt': '',
				'data-copy-text': input.copyText,
				'data-copy-tooltip': input.tooltip,
				...(input.outdated ? { 'data-fork-outdated-copy': '' } : {}),
			}
		: {}
	const statusAttrs = input.status
		? { 'data-package-title-status': input.status }
		: {}
	const shared = {
		'data-testid': input.testId,
		'aria-label': input.label,
		'aria-describedby': tooltipId,
		...statusAttrs,
		...copyAttrs,
	}
	const children = (
		<>
			{renderIcon(input.icon, { size: titleIconSize })}
			<span id={tooltipId} role="tooltip" aria-hidden="true">
				{feedback ?? input.tooltip}
			</span>
			<span role="status" css={visuallyHiddenCss}>
				{feedback ?? ''}
			</span>
		</>
	)
	const styles = titleActionCss
	if (input.href) {
		return (
			<SiteLink href={input.href} {...shared} css={styles} onClick={copy}>
				{children}
			</SiteLink>
		)
	}
	return (
		<button type="button" {...shared} css={styles} onClick={copy}>
			{children}
		</button>
	)
}

const titleActionsCss = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '0.6rem',
	flex: 'none',
} satisfies CSSObject

const titleActionCss = {
	...copyPromptTooltipCss,
	position: 'relative' as const,
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	flex: 'none',
	padding: 0,
	margin: 0,
	border: 'none',
	background: 'none',
	color: colors.textMuted,
	lineHeight: 0,
	cursor: 'pointer',
	textDecoration: 'none',
	'&:hover': {
		color: colors.text,
	},
	'&:focus-visible': {
		outline: `2px solid ${colors.primary}`,
		outlineOffset: '2px',
		borderRadius: '2px',
	},
} satisfies CSSObject

const titleSpinnerCss = {
	...inlineSpinnerCss,
	display: 'inline-block',
	width: titleIconSize,
	height: titleIconSize,
	border: `1.5px solid ${colors.border}`,
	borderTopColor: colors.primary,
	// `inline-block` would otherwise beat the `hidden` attribute in idle.
	'&[hidden]': {
		display: 'none',
	},
} satisfies CSSObject

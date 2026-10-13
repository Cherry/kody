/** @jsxImportSource @emotion/react */
import { buildPackageAppPath } from '@kody-internal/shared/public-urls.ts'
import { type CSSObject } from '@emotion/react'
import { useState } from 'react'
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { SiteLink } from '../components/site-link.tsx'
import { routes } from '#universal/routes.ts'

import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	ForkAheadLink,
	ForkOutdatedCopyButton,
} from '../components/fork-outdated-copy-button.tsx'
import { renderIcon } from '../components/icon.tsx'
import {
	getAccentCalloutCss,
	getGhostButtonCss,
	getPillButtonCss,
	visuallyHiddenCss,
} from '#universal/styles/style-primitives.ts'
import {
	accountDisclosureCss,
	IdValue,
	MetadataGrid,
	TimestampValue,
} from './account-management-components.tsx'
import { RecordChips, recordBodyCss } from './record-table.tsx'
import { AccountPackageDeleteDialog } from './account-package-delete-dialog.tsx'
import { AccountPackageUpdatePublicListing } from './account-package-update-public-listing.tsx'
import { AccountPackageForkAdoption } from './account-package-fork-adoption.tsx'
import { type AccountPackageDetail } from '#universal/loader-data.ts'

import { shortCommunityCommit } from '#universal/community-display.ts'

function isPackageLocked(lockedAt: string | null | undefined) {
	return typeof lockedAt === 'string' && lockedAt.trim().length > 0
}

function hasUnpublishedPackageCommit(packageDetail: AccountPackageDetail) {
	if (!packageDetail.pendingCommitKnown) return false
	const pending = packageDetail.pendingCommit
	if (!pending) return false
	return (
		packageDetail.publishedCommit == null ||
		packageDetail.publishedCommit !== pending
	)
}

/** Primary Approve only when unpublished HEAD is known, or HEAD is unknown. */
function showApprovePublishPrimary(packageDetail: AccountPackageDetail) {
	return (
		!packageDetail.pendingCommitKnown ||
		hasUnpublishedPackageCommit(packageDetail)
	)
}

function publishStateCopy(packageDetail: AccountPackageDetail) {
	const published = packageDetail.publishedCommit
	const pending = packageDetail.pendingCommit
	if (!packageDetail.pendingCommitKnown) {
		return published
			? `Published at ${shortCommunityCommit(published)}. Could not check for an unpublished commit.`
			: 'Could not check for an unpublished commit.'
	}
	if (hasUnpublishedPackageCommit(packageDetail) && pending) {
		const pendingShort = shortCommunityCommit(pending)
		if (!published) {
			return `No published commit yet. Unpublished HEAD is at ${pendingShort}.`
		}
		return `Published at ${shortCommunityCommit(published)}. Unpublished commit pending at ${pendingShort}.`
	}
	if (published) {
		return `Published version is up to date at ${shortCommunityCommit(published)}.`
	}
	return 'No published commit yet.'
}

export function AccountPackageOwnerDetails(props: {
	ownerUsername: string
	packageDetail: AccountPackageDetail
	lockInFlight: boolean
	viewerCanPublish: boolean
	viewerCanDelete: boolean
	viewerCanAdoptCommunityFork: boolean
	onToggleLock: () => void
}) {
	const mutation = usePackageMutation(props.packageDetail.id)
	const capture = useSubmitterScope()
	const [confirmName, setConfirmName] = useState('')
	const [visibilityState, setVisibilityState] = useState<
		'idle' | 'submitting' | 'error'
	>('idle')
	const [visibilityMessage, setVisibilityMessage] = useState<string | null>(
		null,
	)

	async function submitVisibility(
		packageDetail: AccountPackageDetail,
		visibility: 'public' | 'private',
	) {
		if (visibilityState === 'submitting') return
		if (confirmName.trim() !== packageDetail.kodyId) {
			setVisibilityState('error')
			setVisibilityMessage(
				visibility === 'public'
					? `Type ${packageDetail.kodyId} to make this package forkable. Anyone will be able to read and fork the default branch on /community.`
					: `Type ${packageDetail.kodyId} to turn off forkable. Public URLs will 404; existing forks keep their copies.`,
			)

			return
		}
		setVisibilityState('submitting')
		setVisibilityMessage(null)

		const isCurrent = capture()
		try {
			await mutation.submit({
				action: 'set-visibility',
				visibility,
				confirmName: confirmName.trim(),
			})
			if (!isCurrent()) return
			setVisibilityState('idle')
			setConfirmName('')
		} catch (error) {
			if (!isCurrent()) return
			setVisibilityState('error')
			setVisibilityMessage(
				error instanceof Error
					? error.message
					: 'Could not update package visibility.',
			)
		}
	}

	const [internetVisibleConfirmName, setInternetVisibleConfirmName] =
		useState('')
	const [internetVisibleMessage, setInternetVisibleMessage] = useState<
		string | null
	>(null)
	const [internetVisibleApprovalUrl, setInternetVisibleApprovalUrl] = useState<
		string | null
	>(null)
	const internetVisibleState =
		mutation.isPending &&
		mutation.variables?.body.action === 'set-internet-visible'
			? 'submitting'
			: 'idle'
	async function submitInternetVisible(
		packageDetail: AccountPackageDetail,
		internetVisible: boolean,
	) {
		if (mutation.isPending) return
		setInternetVisibleApprovalUrl(null)
		if (internetVisibleConfirmName.trim() !== packageDetail.kodyId) {
			setInternetVisibleMessage(
				internetVisible
					? `Type ${packageDetail.kodyId} to continue. You will review credentials before the app is served publicly.`
					: `Type ${packageDetail.kodyId} to turn off internet-visible serving.`,
			)
			return
		}
		const isCurrent = capture()
		setInternetVisibleMessage(null)
		try {
			await mutation.submit({
				action: 'set-internet-visible',
				internetVisible,
				confirmName: internetVisibleConfirmName.trim(),
			})
			if (isCurrent()) setInternetVisibleConfirmName('')
		} catch (error) {
			if (!isCurrent()) return
			setInternetVisibleMessage(
				error instanceof Error
					? error.message
					: 'Could not update internet-visible setting.',
			)
			if (
				error instanceof Error &&
				'approvalUrl' in error &&
				typeof error.approvalUrl === 'string'
			)
				setInternetVisibleApprovalUrl(error.approvalUrl)
		}
	}

	const { packageDetail, lockInFlight, onToggleLock } = props
	return (
		<div css={recordBodyCss} data-testid="package-owner-details">
			<div css={{ display: 'grid', gap: spacing.xs }}>
				<div
					css={{
						display: 'flex',
						alignItems: 'center',
						gap: spacing.xs,
						flexWrap: 'wrap',
						minWidth: 0,
					}}
				>
					<h2
						css={{
							margin: 0,
							fontSize: typography.fontSize.lg,
							fontWeight: typography.fontWeight.semibold,
							color: colors.text,
							overflowWrap: 'anywhere',
						}}
					>
						{packageDetail.name}
					</h2>
					<button
						type="button"
						disabled={lockInFlight}
						title={
							isPackageLocked(packageDetail.lockedAt)
								? 'Unlock publishes'
								: 'Lock publishes'
						}
						data-testid="account-package-lock-toggle"
						data-locked={
							isPackageLocked(packageDetail.lockedAt) ? 'true' : 'false'
						}
						css={packageLockToggleCss}
						onClick={() => onToggleLock()}
					>
						{packageLockGlyph(isPackageLocked(packageDetail.lockedAt))}
						<span css={visuallyHiddenCss}>
							{isPackageLocked(packageDetail.lockedAt)
								? `Unlock publishes for ${packageDetail.name}`
								: `Lock publishes for ${packageDetail.name}`}
						</span>
					</button>
					{packageDetail.listingAhead ? (
						<ForkOutdatedCopyButton
							prompt={packageDetail.listingAhead.prompt}
							testId="account-package-listing-ahead"
							href={packageDetail.listingAhead.diffHref}
						/>
					) : packageDetail.forkAhead ? (
						<ForkAheadLink
							href={packageDetail.forkAhead.diffHref}
							testId="account-package-listing-fork-ahead"
						/>
					) : null}
				</div>
				{packageDetail.description ? (
					<p
						css={{
							margin: 0,
							color: colors.textMuted,
							overflowWrap: 'anywhere',
						}}
					>
						{packageDetail.description}
					</p>
				) : (
					<p css={{ margin: 0, color: colors.textMuted }}>
						This package has no description.
					</p>
				)}
			</div>
			<div css={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
				{packageDetail.hidden ? <span css={statusBadgeCss}>Hidden</span> : null}
				{packageDetail.isPrivate ? (
					<span css={statusBadgeCss}>Not forkable</span>
				) : null}
				{!packageDetail.isPrivate ? (
					<span css={communityBadgeCss}>Forkable</span>
				) : (
					<span css={statusBadgeCss}>Not forkable</span>
				)}
				{packageDetail.isInternetVisible ? (
					<span css={communityBadgeCss}>Internet-visible</span>
				) : (
					<span css={statusBadgeCss}>Private app</span>
				)}
				<span css={statusBadgeCss}>
					{packageDetail.hasCommunityListing ? 'Listed' : 'Not listed'}
				</span>
			</div>
			{props.viewerCanPublish ? (
				<div
					css={{ display: 'grid', gap: spacing.md }}
					data-testid="package-visibility-controls"
				>
					<AccountPackageUpdatePublicListing
						packageDetail={props.packageDetail}
					/>
					<div css={{ display: 'grid', gap: spacing.xs }}>
						<p css={{ margin: 0, color: colors.textMuted }}>
							{packageDetail.isPrivate
								? "Lists the source on /community so anyone can read and fork it. Doesn't host your app."
								: 'Turning off forkable unlists the package from /community and 404s public source URLs. Existing forks keep their copies. Does not change internet-visible app hosting. Type the slug to confirm.'}
						</p>
						<label css={{ display: 'grid', gap: spacing.xs }}>
							<span css={visuallyHiddenCss}>
								Type {packageDetail.kodyId} to change forkable
							</span>
							<input
								value={confirmName}
								placeholder={packageDetail.kodyId}
								data-testid={
									packageDetail.isPrivate
										? 'package-make-public-confirm'
										: 'package-make-private-confirm'
								}
								css={{
									padding: spacing.sm,
									borderRadius: radius.md,
									border: `1px solid ${colors.border}`,
									backgroundColor: colors.surface,
									color: colors.text,
								}}
								onChange={(event) => {
									if (!(event.currentTarget instanceof HTMLInputElement)) {
										return
									}
									setConfirmName(event.currentTarget.value)
								}}
							/>
						</label>
						<button
							type="button"
							disabled={visibilityState === 'submitting'}
							data-testid={
								packageDetail.isPrivate
									? 'package-make-public'
									: 'package-make-private'
							}
							css={getGhostButtonCss()}
							onClick={() =>
								void submitVisibility(
									packageDetail,
									packageDetail.isPrivate ? 'public' : 'private',
								)
							}
						>
							{visibilityState === 'submitting'
								? 'Saving…'
								: packageDetail.isPrivate
									? 'Make forkable'
									: 'Turn off forkable'}
						</button>
						{visibilityMessage ? (
							<p css={{ margin: 0, color: colors.danger }} role="alert">
								{visibilityMessage}
							</p>
						) : null}
					</div>
					<div
						css={{ display: 'grid', gap: spacing.xs }}
						data-testid="package-internet-visible-controls"
					>
						<p css={{ margin: 0, color: colors.textMuted }}>
							{packageDetail.isInternetVisible
								? 'Turning off internet-visible returns the app to owner-session serving. Community listing stays unchanged.'
								: "Kody hosts your app at a public URL anyone can open without signing in. This is separate from Community listing. Don't use it for apps that show your private data."}
						</p>
						{packageDetail.hasApp ? null : (
							<p css={{ margin: 0, color: colors.textMuted }}>
								This package has no app yet. You can still approve capabilities
								after publish; serving stays inactive until an app exists.
							</p>
						)}
						<label css={{ display: 'grid', gap: spacing.xs }}>
							<span css={visuallyHiddenCss}>
								Type {packageDetail.kodyId} to change internet-visible
							</span>
							<input
								value={internetVisibleConfirmName}
								placeholder={packageDetail.kodyId}
								data-testid={
									packageDetail.isInternetVisible
										? 'package-internet-visible-off-confirm'
										: 'package-internet-visible-on-confirm'
								}
								css={{
									padding: spacing.sm,
									borderRadius: radius.md,
									border: `1px solid ${colors.border}`,
									backgroundColor: colors.surface,
									color: colors.text,
								}}
								onChange={(event) => {
									if (!(event.currentTarget instanceof HTMLInputElement)) {
										return
									}
									setInternetVisibleConfirmName(event.currentTarget.value)
								}}
							/>
						</label>
						<div
							css={{
								display: 'flex',
								flexWrap: 'wrap',
								gap: spacing.xs,
							}}
						>
							<button
								type="button"
								disabled={internetVisibleState === 'submitting'}
								data-testid={
									packageDetail.isInternetVisible
										? 'package-internet-visible-off'
										: 'package-internet-visible-on'
								}
								css={getGhostButtonCss()}
								onClick={() =>
									void submitInternetVisible(
										packageDetail,
										!packageDetail.isInternetVisible,
									)
								}
							>
								{internetVisibleState === 'submitting'
									? 'Saving…'
									: packageDetail.isInternetVisible
										? 'Turn off internet-visible'
										: 'Make internet-visible'}
							</button>
							<SiteLink
								href={routes.communityPackageApproveCapabilities.href({
									username: props.ownerUsername,
									kodyId: packageDetail.kodyId,
								})}
								data-testid="package-approve-capabilities-link"
								css={{
									...getPillButtonCss({ size: 'sm' }),
									display: 'inline-flex',
									textDecoration: 'none',
								}}
							>
								Review capabilities
							</SiteLink>
						</div>
						{internetVisibleMessage ? (
							<p css={{ margin: 0, color: colors.danger }} role="alert">
								{internetVisibleMessage}
								{internetVisibleApprovalUrl ? (
									<>
										{' '}
										<SiteLink href={internetVisibleApprovalUrl}>
											Open approval page
										</SiteLink>
									</>
								) : null}
							</p>
						) : null}
					</div>
				</div>
			) : null}
			{packageDetail.tags.length > 0 ? (
				<RecordChips items={packageDetail.tags} />
			) : null}
			<MetadataGrid
				items={[
					{
						label: 'Kody id',
						value: <IdValue value={packageDetail.kodyId} label="Kody id" />,
					},
					{
						label: 'Package id',
						value: <IdValue value={packageDetail.id} label="package id" />,
					},
					{
						label: 'App',
						value: packageDetail.hasApp ? (
							<a
								href={buildPackageAppPath({
									username: props.ownerUsername,
									kodyId: packageDetail.kodyId,
								})}
								data-testid="open-package-app"
								css={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: '0.35rem',
									color: colors.primaryText,
									fontWeight: typography.fontWeight.semibold,
									textDecoration: 'none',
									'&:hover': { color: colors.text },
								}}
							>
								{renderIcon('share', { size: '1em' })} Open Package App
							</a>
						) : (
							'No app'
						),
					},
					{
						label: 'Source id',
						value: <IdValue value={packageDetail.sourceId} label="source id" />,
					},
					{
						label: 'Created',
						value: <TimestampValue value={packageDetail.createdAt} />,
					},
					{
						label: 'Updated',
						value: <TimestampValue value={packageDetail.updatedAt} />,
					},
					{
						label: 'Publish lock',
						value: packageDetail.lockedAt ? (
							<>
								Locked <TimestampValue value={packageDetail.lockedAt} />
							</>
						) : (
							'Off'
						),
					},
				]}
			/>
			<div css={getAccentCalloutCss()}>
				<p
					css={{ margin: 0, color: colors.text }}
					data-testid="package-publish-state"
				>
					{publishStateCopy(packageDetail)}
				</p>
				<p css={{ margin: 0, color: colors.textMuted }}>
					{packageDetail.lockedAt
						? 'Publishes stay on this reviewed tree until you promote a commit on the website. Click the lock icon to unlock.'
						: 'Click the lock icon so agents cannot publish without your approval.'}
				</p>
				{packageDetail.lockedAt ? (
					<div
						css={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: spacing.xs,
							alignItems: 'center',
						}}
					>
						<SiteLink
							href={routes.communityPackageApprovePublish.href({
								username: props.ownerUsername,
								kodyId: packageDetail.kodyId,
							})}
							data-testid="account-approve-publish"
							css={
								showApprovePublishPrimary(packageDetail)
									? {
											...getPillButtonCss({ size: 'sm' }),
											display: 'inline-flex',
											textDecoration: 'none',
										}
									: approvePublishQuietLinkCss
							}
						>
							Approve a publish
						</SiteLink>
					</div>
				) : null}
			</div>
			{props.viewerCanAdoptCommunityFork && packageDetail.communityFork ? (
				<AccountPackageForkAdoption
					packageDetail={packageDetail}
					communityFork={packageDetail.communityFork}
				/>
			) : null}
			{props.viewerCanDelete ? (
				<AccountPackageDeleteDialog
					ownerUsername={props.ownerUsername}
					packageDetail={packageDetail}
				/>
			) : null}
			{packageDetail.searchText ? (
				<details css={accountDisclosureCss}>
					<summary>Search text</summary>
					<p
						css={{
							margin: 0,
							maxHeight: '12rem',
							overflowY: 'auto',
							padding: spacing.sm,
							borderRadius: radius.md,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.background,
							color: colors.textMuted,
							fontSize: typography.fontSize.sm,
							overflowWrap: 'anywhere',
						}}
					>
						{packageDetail.searchText}
					</p>
				</details>
			) : null}
		</div>
	)
}

function packageLockGlyph(locked: boolean) {
	return renderIcon(locked ? 'lock' : 'lock-unlocked', { size: '1em' })
}

const packageLockToggleCss = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '1.85rem',
	height: '1.85rem',
	padding: 0,
	border: `1px solid ${colors.border}`,
	borderRadius: '999px',
	backgroundColor: 'transparent',
	color: colors.textMuted,
	cursor: 'pointer',
	flexShrink: 0,
	'&:hover': {
		color: colors.primaryText,
		borderColor: colors.primaryText,
	},
	'&:focus-visible': {
		outline: `2px solid ${colors.primary}`,
		outlineOffset: '2px',
	},
	'&[data-locked="true"]': {
		color: colors.primary,
		borderColor: colors.primary,
		backgroundColor: `oklch(from ${colors.primary} l c h / 0.13)`,
		'&:hover': {
			color: colors.primaryText,
			borderColor: colors.primaryText,
			backgroundColor: `oklch(from ${colors.primary} l c h / 0.2)`,
		},
	},
} satisfies CSSObject

const statusBadgeCss = {
	padding: `${spacing.xs} ${spacing.sm}`,
	borderRadius: radius.full,
	backgroundColor: colors.surface,
	border: `1px solid ${colors.border}`,
	color: colors.textMuted,
	fontSize: typography.fontSize.xs,
	fontWeight: typography.fontWeight.medium,
} satisfies CSSObject

const communityBadgeCss = {
	...statusBadgeCss,
	backgroundColor: colors.primarySoft,
	border: 'none',
	color: colors.primaryText,
	fontWeight: typography.fontWeight.semibold,
} satisfies CSSObject

const approvePublishQuietLinkCss = {
	color: colors.textMuted,
	fontSize: typography.fontSize.sm,
	textDecoration: 'underline',
	textUnderlineOffset: '0.15em',
	'&:hover': {
		color: colors.text,
	},
} satisfies CSSObject

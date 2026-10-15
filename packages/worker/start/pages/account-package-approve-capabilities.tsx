/** @jsxImportSource @emotion/react */
import { PackageSecurityAuditField } from './package-security-audit-field.tsx'
import { useMatchedPageScope } from '../use-matched-page-scope.ts'
import { useState, type ReactNode } from 'react'
import { type CSSObject } from '@emotion/react'
import { isCredentialKind } from '#universal/credential-contracts.ts'
import { credentialKindLabel } from '#universal/credentials-list.ts'
import { useRouter } from '@tanstack/react-router'
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { SiteLink } from '../components/site-link.tsx'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountManagementHeader,
	IdValue,
	MetadataGrid,
	accountDisclosureCss,
} from './account-management-components.tsx'
import {
	type AccountPackagePendingApproval,
	type AccountPackageApproveCapabilitiesLoaderData,
} from '#universal/loader-data.ts'
import {
	getAccentCalloutCss,
	getGhostButtonCss,
	getPrimaryButtonCss,
} from '#universal/styles/style-primitives.ts'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
type CapabilityEntry =
	AccountPackageApproveCapabilitiesLoaderData['entries'][number]

/**
 * The dependency on an entry's reach path, or null when only the package
 * itself reaches it. Deduped rows keep the longest path, so a dependency path
 * does not rule out the package also using the entry directly.
 */
function reachingDependency(entry: CapabilityEntry) {
	return entry.via.length > 1 ? (entry.via.at(-1) ?? null) : null
}

function credentialKindText(kind: string | undefined) {
	if (kind === undefined) return credentialKindLabel('secret')
	return isCredentialKind(kind) ? credentialKindLabel(kind) : kind
}

function credentialSummary(entry: CapabilityEntry) {
	const dependency = reachingDependency(entry)
	return `${credentialKindText(entry.credentialKind)} · ${
		dependency
			? `reachable through its dependency ${dependency}`
			: 'used by this package'
	}`
}

function storageSummary(entry: CapabilityEntry) {
	const dependency = reachingDependency(entry)
	return dependency
		? `Its dependency ${dependency} can save and read its own data.`
		: 'This package can save and read its own data.'
}

const credentialValuesNote = 'Credential values never appear here.'

function sentence(text: string) {
	const trimmed = text.trim()
	if (trimmed.length === 0) return trimmed
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Page title and lead copy follow what is actually waiting. Public / internet
 * visibility is mentioned only when a went_public request is pending or the
 * page is the capability-set pin for internet-visible serving.
 */
function approveCapabilitiesPageCopy(
	payload: AccountPackageApproveCapabilitiesLoaderData,
) {
	const pending = payload.pendingApprovals
	const hasWentPublic = pending.some(
		(approval) => approval.reason === 'went_public',
	)
	const hasCredentialNeeds = pending.some(
		(approval) => approval.reason === 'credential_needs_changed',
	)
	if (pending.length > 0 && hasCredentialNeeds && !hasWentPublic) {
		const changeLines = pending.flatMap((approval) => approval.changes)
		const what =
			changeLines.length > 0
				? changeLines.map(sentence).join(' ')
				: 'This version changes the package’s credential needs.'
		return {
			title: 'Approve credential needs',
			description: `${what} The previously published version keeps running until you approve. ${credentialValuesNote}`,
			mentionInternet: false,
		}
	}
	if (pending.length > 0 && hasWentPublic) {
		return {
			title: 'Approve package changes',
			description: hasCredentialNeeds
				? `Review the credential and internet-visibility changes below. ${credentialValuesNote}`
				: `Approving turns on internet-visible serving for this package. ${credentialValuesNote}`,
			mentionInternet: true,
		}
	}
	if (payload.package.isInternetVisible) {
		return {
			title: 'Approve internet-visible capabilities',
			description: `${payload.package.name} is served on the public internet. Check what it can use before you re-approve. ${credentialValuesNote}`,
			mentionInternet: true,
		}
	}
	return {
		title: 'Approve internet-visible capabilities',
		description: `Before ${payload.package.name} is served on the public internet, check what it can use. ${credentialValuesNote}`,
		mentionInternet: true,
	}
}

function credentialsSectionIntro(input: {
	isInternetVisible: boolean
	mentionInternet: boolean
}) {
	// Entries are the currently published capability set. On credential-needs-only
	// review, do not attribute them to the paused publish (shown above) or imply
	// they are already reachable via public requests.
	if (!input.mentionInternet) {
		return 'The previously published version can use these.'
	}
	if (input.isInternetVisible) {
		return 'It is internet-visible, so requests from anyone can run code that uses these.'
	}
	return 'Once it is internet-visible, requests from anyone can run code that uses these.'
}

/**
 * Raw identifiers for the collapsed Details disclosure. The decision itself
 * reads in plain language; these are copy targets for support and agents.
 */
function approveCapabilitiesDetailItems(
	payload: AccountPackageApproveCapabilitiesLoaderData,
) {
	const items: Array<{ key: string; label: string; value: ReactNode }> = [
		{
			key: 'published-commit',
			label: 'Published commit',
			value: payload.publishedCommit ? (
				<IdValue value={payload.publishedCommit} label="published commit" />
			) : (
				'Not published'
			),
		},
		{
			key: 'fingerprint',
			label: 'Capability fingerprint',
			value: <IdValue value={payload.fingerprint} label="fingerprint" />,
		},
	]
	for (const entry of payload.entries) {
		if (entry.kind === 'credential' && entry.credentialId) {
			const name = entry.name ?? 'Credential'
			items.push({
				key: `credential:${entry.credentialId}`,
				label: `${name} credential ID`,
				value: (
					<IdValue value={entry.credentialId} label={`${name} credential ID`} />
				),
			})
		} else if (entry.kind === 'storage' && entry.storageId) {
			const dependency = reachingDependency(entry)
			const label = dependency
				? `Package storage ID (${dependency})`
				: 'Package storage ID'
			items.push({
				key: `storage:${entry.storageId}`,
				label,
				value: <IdValue value={entry.storageId} label={label} />,
			})
		}
	}
	return items
}

export function AccountPackageApproveCapabilitiesRoute({
	payload,
}: {
	payload: AccountPackageApproveCapabilitiesLoaderData
	username: string
	kodyId: string
}) {
	const mutation = usePackageMutation(payload.package.id)
	const capture = useSubmitterScope()
	const router = useRouter()
	const currentHref = useMatchedPageScope().pageLocation.href
	const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
		null,
	)
	const [approvingCapabilities, setApprovingCapabilities] = useState(false)
	const busy =
		mutation.isPending || approvingRequestId !== null || approvingCapabilities
	const goPublicRequestId = payload.goPublicRequestId ?? null
	const allPendingApprovals = payload.pendingApprovals ?? []
	const pendingApprovals = goPublicRequestId
		? allPendingApprovals.filter(
				(approval) => approval.id !== goPublicRequestId,
			)
		: allPendingApprovals
	const pageCopy = approveCapabilitiesPageCopy(payload)
	const hasWentPublicPending = pendingApprovals.some(
		(approval) => approval.reason === 'went_public',
	)
	const hasCredentialNeedsPending = pendingApprovals.some(
		(approval) => approval.reason === 'credential_needs_changed',
	)
	const [message, setMessage] = useState<string | null>(null)
	const credentialEntries = payload.entries.filter(
		(entry) => entry.kind === 'credential',
	)
	const storageEntries = payload.entries.filter(
		(entry) => entry.kind === 'storage',
	)
	async function approvePending(approval: AccountPackagePendingApproval) {
		if (!approval.approveAction || busy) return
		const isCurrent = capture()
		setApprovingRequestId(approval.id)
		setMessage(null)
		try {
			await mutation.submit({
				action: approval.approveAction,
				requestId: approval.id,
			})
			if (isCurrent()) await router.invalidate({ sync: true })
		} catch (error) {
			if (isCurrent())
				setMessage(
					error instanceof Error
						? error.message
						: 'Could not approve this publish.',
				)
		} finally {
			if (isCurrent()) setApprovingRequestId(null)
		}
	}
	async function approveCapabilities() {
		if (!payload.publishedCommit || busy) return
		setApprovingCapabilities(true)
		const isCurrent = capture()
		setMessage(null)
		try {
			await mutation.submit(
				goPublicRequestId
					? {
							action: 'approve-capabilities-and-go-public',
							fingerprint: payload.fingerprint,
							requestId: goPublicRequestId,
						}
					: {
							action: 'approve-capabilities',
							fingerprint: payload.fingerprint,
						},
			)
			if (isCurrent()) {
				if (payload.package.isInternetVisible || goPublicRequestId)
					await router.navigate({ to: payload.settingsHref })
				else await router.invalidate({ sync: true })
			}
		} catch (error) {
			if (isCurrent())
				setMessage(
					error instanceof Error
						? error.message
						: 'Could not approve capabilities.',
				)
		} finally {
			if (isCurrent()) setApprovingCapabilities(false)
		}
	}
	return (
		<AccountManagementShell
			currentHref={currentHref}
			busy={busy}
			maxWidth="46rem"
		>
			<AccountManagementHeader
				eyebrow={
					payload ? (
						<p
							data-testid="package-approve-capabilities-package"
							css={packageContextCss}
						>
							{payload.package.name}
						</p>
					) : null
				}
				title={pageCopy.title}
				description={pageCopy.description}
			/>
			{message ? (
				<AccountManagementMessage tone="error">
					{message}
				</AccountManagementMessage>
			) : null}

			{pendingApprovals.length > 0 ? (
				<section
					data-testid="package-pending-approvals"
					aria-labelledby="package-pending-approvals-heading"
					css={{ display: 'grid', gap: spacing.md }}
				>
					<h2 id="package-pending-approvals-heading" css={heroHeadingCss}>
						Waiting for your approval
					</h2>
					<p css={{ margin: 0, color: colors.textMuted }}>
						{hasWentPublicPending
							? 'Internet-visible serving stays off until you approve.'
							: hasCredentialNeedsPending
								? 'The previously published version keeps running until you approve.'
								: 'Nothing changes until you approve.'}
					</p>
					<ul css={cardListCss}>
						{pendingApprovals.map((approval) => (
							<li
								key={approval.id}
								data-testid="package-pending-approval"
								css={capabilityRowCss}
							>
								<strong css={cardTitleCss}>{approval.reasonLabel}</strong>
								{approval.changes.length > 0 ? (
									<ul css={{ margin: 0, color: colors.textMuted }}>
										{approval.changes.map((change) => (
											<li key={change}>{change}</li>
										))}
									</ul>
								) : null}
								<details css={accountDisclosureCss}>
									<summary>Details</summary>
									<MetadataGrid
										items={[
											{
												label:
													approval.reason === 'went_public'
														? 'Published commit'
														: 'Paused commit',
												value: (
													<IdValue
														value={approval.pendingCommit}
														label={
															approval.reason === 'went_public'
																? 'published commit'
																: 'paused commit'
														}
													/>
												),
											},
										]}
									/>
								</details>
								{approval.approveAction ? (
									<div>
										<button
											type="button"
											disabled={busy}
											data-testid="package-pending-approval-approve"
											css={getPrimaryButtonCss()}
											onClick={() => void approvePending(approval)}
										>
											{approvingRequestId === approval.id
												? 'Approving…'
												: approval.reason === 'went_public'
													? 'Approve and make internet-visible'
													: 'Approve and publish'}
										</button>
									</div>
								) : null}
							</li>
						))}
					</ul>
				</section>
			) : null}
			{payload ? (
				<section
					data-testid="package-approve-capabilities-card"
					aria-label="Capability set"
					css={{ display: 'grid', gap: spacing.xl }}
				>
					{!payload.publishedCommit && pageCopy.mentionInternet ? (
						<div css={getAccentCalloutCss()}>
							<p css={{ margin: 0, color: colors.textMuted }}>
								Publish this package before approving internet-visible
								capabilities.
							</p>
						</div>
					) : null}
					{payload.fingerprintMatchesApproval ? (
						<div css={getAccentCalloutCss()}>
							<p css={{ margin: 0, color: colors.textMuted }}>
								This capability set is already approved
								{payload.latestApprovedAt
									? ` (${payload.latestApprovedAt})`
									: ''}
								{payload.package.isInternetVisible
									? '. Approving again keeps internet-visible on for the same set.'
									: '.'}
							</p>
						</div>
					) : null}
					<section
						data-testid="package-approve-capabilities-credentials"
						aria-labelledby="package-approve-capabilities-credentials-heading"
						css={{ display: 'grid', gap: spacing.md }}
					>
						<h2
							id="package-approve-capabilities-credentials-heading"
							css={heroHeadingCss}
						>
							Credentials
						</h2>
						{credentialEntries.length === 0 ? (
							<p css={{ margin: 0, color: colors.textMuted }}>
								This package does not use any of your credentials.
							</p>
						) : (
							<>
								<p css={{ margin: 0, color: colors.textMuted }}>
									{credentialsSectionIntro({
										isInternetVisible: payload.package.isInternetVisible,
										mentionInternet: pageCopy.mentionInternet,
									})}
								</p>
								<ul css={cardListCss}>
									{credentialEntries.map((entry) => (
										<li
											key={entry.credentialId ?? entry.name}
											data-testid="package-approve-capabilities-credential"
											css={capabilityRowCss}
										>
											<strong css={cardTitleCss}>
												{entry.name ?? 'Unnamed credential'}
											</strong>
											<span css={{ color: colors.textMuted }}>
												{credentialSummary(entry)}
											</span>
											<span css={{ color: colors.textMuted }}>
												{entry.hosts.length > 0
													? `Can only be sent to ${entry.hosts.join(', ')}`
													: 'No hosts approved yet'}
											</span>
										</li>
									))}
								</ul>
							</>
						)}
					</section>
					<section
						data-testid="package-approve-capabilities-other"
						aria-labelledby="package-approve-capabilities-other-heading"
						css={{ display: 'grid', gap: spacing.md }}
					>
						<h2
							id="package-approve-capabilities-other-heading"
							css={heroHeadingCss}
						>
							Other capabilities
						</h2>
						{storageEntries.length === 0 ? (
							<p css={{ margin: 0, color: colors.textMuted }}>
								No other capabilities.
							</p>
						) : (
							<ul css={cardListCss}>
								{storageEntries.map((entry) => (
									<li
										key={entry.storageId}
										data-testid="package-approve-capabilities-storage"
										css={capabilityRowCss}
									>
										<strong css={cardTitleCss}>Package storage</strong>
										<span css={{ color: colors.textMuted }}>
											{storageSummary(entry)}
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
					<PackageSecurityAuditField
						audit={payload.securityAudit}
						packageName={payload.package.name}
						hasPausedPublish={allPendingApprovals.some(
							(approval) => approval.pendingCommit !== payload.publishedCommit,
						)}
					/>
					{goPublicRequestId ? (
						<p
							data-testid="package-approve-capabilities-go-public-note"
							css={{ margin: 0, color: colors.textMuted }}
						>
							You asked to make this package internet-visible. One approval
							records this capability set and turns on internet-visible serving.
						</p>
					) : null}
					<div
						css={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: spacing.sm,
							alignItems: 'center',
						}}
					>
						{pageCopy.mentionInternet ? (
							<button
								type="button"
								disabled={busy || !payload.publishedCommit}
								data-testid="package-approve-capabilities"
								css={getPrimaryButtonCss()}
								onClick={() => void approveCapabilities()}
							>
								{approvingCapabilities
									? 'Approving…'
									: goPublicRequestId
										? 'Approve and make internet-visible'
										: payload.package.isInternetVisible
											? 'Re-approve capability set'
											: 'Approve capability set'}
							</button>
						) : null}
						<SiteLink
							href={payload.settingsHref}
							css={getGhostButtonCss()}
							data-testid="package-approve-capabilities-back"
						>
							Back to package settings
						</SiteLink>
					</div>
					<details
						data-testid="package-approve-capabilities-details"
						css={accountDisclosureCss}
					>
						<summary>Details</summary>
						<MetadataGrid items={approveCapabilitiesDetailItems(payload)} />
					</details>
				</section>
			) : null}
		</AccountManagementShell>
	)
}
const packageContextCss: CSSObject = {
	margin: 0,
	width: 'fit-content',
	maxWidth: '100%',
	overflowWrap: 'anywhere' as const,
	fontSize: typography.fontSize.sm,
	fontWeight: typography.fontWeight.semibold,
	color: colors.primaryText,
	backgroundColor: colors.primarySoft,
	borderRadius: radius.full,
	padding: '0.2rem 0.7rem',
}

const heroHeadingCss: CSSObject = {
	margin: 0,
	fontSize: '1.35rem',
	fontWeight: 720,
	letterSpacing: '-0.014em',
	lineHeight: 1.2,
	color: colors.text,
}

const cardListCss: CSSObject = {
	margin: 0,
	padding: 0,
	listStyle: 'none',
	display: 'grid',
	gap: spacing.sm,
}

const cardTitleCss: CSSObject = {
	color: colors.text,
	fontSize: typography.fontSize.base,
	overflowWrap: 'anywhere' as const,
}

const capabilityRowCss: CSSObject = {
	display: 'grid',
	gap: spacing.xs,
	padding: spacing.md,
	borderRadius: radius.md,
	border: `1px solid ${colors.border}`,
	backgroundColor: colors.surface,
	minWidth: 0,
}

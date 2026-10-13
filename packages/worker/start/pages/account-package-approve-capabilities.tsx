/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { SiteLink } from '../components/site-link.tsx'
import { routes } from '#universal/routes.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	IdValue,
	MetadataGrid,
	accountDisclosureCss,
} from './account-management-components.tsx'
import { type AccountPackageApproveCapabilitiesLoaderData } from '#universal/loader-data.ts'
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
export function AccountPackageApproveCapabilitiesRoute({
	payload,
	username,
	kodyId,
}: {
	payload: AccountPackageApproveCapabilitiesLoaderData
	username: string
	kodyId: string
}) {
	const mutation = usePackageMutation(payload.package.id)
	const capture = useSubmitterScope()
	const router = useRouter()
	const currentHref = useLocation({ select: (l) => l.href })
	const [message, setMessage] = useState<string | null>(null)
	const credentialEntries = payload.entries.filter(
		(entry) => entry.kind === 'credential',
	)
	const storageEntries = payload.entries.filter(
		(entry) => entry.kind === 'storage',
	)
	async function approveCapabilities() {
		if (!payload.publishedCommit || mutation.isPending) return
		const isCurrent = capture()
		setMessage(null)
		try {
			await mutation.submit(
				{ action: 'approve-capabilities', fingerprint: payload.fingerprint },
				routes.communityPackageApproveCapabilitiesApi.href({
					username,
					kodyId,
				}),
			)
			if (isCurrent()) await router.navigate({ to: payload.settingsHref })
		} catch (error) {
			if (isCurrent())
				setMessage(
					error instanceof Error
						? error.message
						: 'Could not approve capabilities.',
				)
		}
	}
	return (
		<AccountManagementShell busy={mutation.isPending}>
			<AccountPageHeader
				title="Approve internet-visible capabilities"
				description="Review every credential and capability this package can reach before serving it on the public internet. Secret values never appear here."
				currentHref={currentHref}
			/>
			{message ? (
				<AccountManagementMessage tone="error">
					{message}
				</AccountManagementMessage>
			) : null}
			<section
				data-testid="package-approve-capabilities-card"
				css={{ display: 'grid', gap: spacing.lg }}
			>
				<MetadataGrid
					items={[
						{
							label: 'Package',
							value: payload.package.name,
						},
						{
							label: 'Slug',
							value: (
								<IdValue value={payload.package.kodyId} label="package slug" />
							),
						},
						{
							label: 'Published commit',
							value: payload.publishedCommit ? (
								<IdValue
									value={payload.publishedCommit}
									label="published commit"
								/>
							) : (
								'Not published'
							),
						},
						{
							label: 'Fingerprint',
							value: (
								<IdValue value={payload.fingerprint} label="fingerprint" />
							),
						},
					]}
				/>
				{!payload.publishedCommit ? (
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
							{payload.latestApprovedAt ? ` (${payload.latestApprovedAt})` : ''}
							. Approving again keeps internet-visible on for the same set.
						</p>
					</div>
				) : null}
				<section css={{ display: 'grid', gap: spacing.md }}>
					<h2
						css={{
							margin: 0,
							fontSize: typography.fontSize.lg,
							fontWeight: typography.fontWeight.semibold,
						}}
					>
						Credentials
					</h2>
					{credentialEntries.length === 0 ? (
						<p css={{ margin: 0, color: colors.textMuted }}>
							No user credentials are reachable from this package's current
							tree.
						</p>
					) : (
						<ul
							css={{
								margin: 0,
								padding: 0,
								listStyle: 'none',
								display: 'grid',
								gap: spacing.sm,
							}}
						>
							{credentialEntries.map((entry) => (
								<li
									key={entry.credentialId ?? entry.name}
									css={capabilityRowCss}
								>
									<div css={{ display: 'grid', gap: spacing.xs }}>
										<strong css={{ color: colors.text }}>
											{entry.name ?? entry.credentialId}
										</strong>
										<span css={{ color: colors.textMuted }}>
											{entry.credentialKind ?? 'secret'} · id{' '}
											<code>{entry.credentialId}</code>
										</span>
										<span css={{ color: colors.textMuted }}>
											Hosts:{' '}
											{entry.hosts.length > 0
												? entry.hosts.join(', ')
												: 'none approved'}
										</span>
										<details css={accountDisclosureCss}>
											<summary>How it is reached</summary>
											<p css={{ margin: 0, color: colors.textMuted }}>
												{entry.via.join(' → ')}
											</p>
										</details>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>
				<section css={{ display: 'grid', gap: spacing.md }}>
					<h2
						css={{
							margin: 0,
							fontSize: typography.fontSize.lg,
							fontWeight: typography.fontWeight.semibold,
						}}
					>
						Other capabilities
					</h2>
					{storageEntries.length === 0 ? (
						<p css={{ margin: 0, color: colors.textMuted }}>
							No additional storage capabilities.
						</p>
					) : (
						<ul
							css={{
								margin: 0,
								padding: 0,
								listStyle: 'none',
								display: 'grid',
								gap: spacing.sm,
							}}
						>
							{storageEntries.map((entry) => (
								<li key={entry.storageId} css={capabilityRowCss}>
									<strong css={{ color: colors.text }}>Package storage</strong>
									<span css={{ color: colors.textMuted }}>
										<code>{entry.storageId}</code>
										{entry.via.length > 0
											? ` via ${entry.via.join(' → ')}`
											: ''}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>
				<div
					css={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: spacing.sm,
						alignItems: 'center',
					}}
				>
					<button
						type="button"
						disabled={mutation.isPending || !payload.publishedCommit}
						data-testid="package-approve-capabilities"
						css={getPrimaryButtonCss()}
						onClick={() => void approveCapabilities()}
					>
						{mutation.isPending
							? 'Approving…'
							: payload.package.isInternetVisible
								? 'Re-approve capability set'
								: 'Approve and make internet-visible'}
					</button>
					<SiteLink
						href={payload.settingsHref}
						css={getGhostButtonCss()}
						data-testid="package-approve-capabilities-back"
					>
						Back to settings
					</SiteLink>
				</div>
			</section>
		</AccountManagementShell>
	)
}
const capabilityRowCss = {
	display: 'grid',
	gap: spacing.xs,
	padding: spacing.md,
	borderRadius: radius.md,
	border: `1px solid ${colors.border}`,
	backgroundColor: colors.surface,
}

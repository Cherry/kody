/** @jsxImportSource @emotion/react */
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { type CSSObject } from '@emotion/react'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useLocation } from '@tanstack/react-router'

import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
	IdValue,
	MetadataGrid,
} from './account-management-components.tsx'
import { SiteLink } from '../components/site-link.tsx'
import {
	getAccentCalloutCss,
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import { type AccountPackageApprovePublishLoaderData } from '#universal/loader-data.ts'
export function AccountPackageApprovePublishRoute({
	payload,
}: {
	payload: AccountPackageApprovePublishLoaderData
	username: string
	kodyId: string
}) {
	const mutation = usePackageMutation(payload.package.id)
	const capture = useSubmitterScope()
	const router = useRouter(),
		currentHref = useLocation({ select: (l) => l.href })
	const [busy, setBusy] = useState(false),
		[message, setMessage] = useState<string | null>(null)
	const busyRef = useRef(false),
		mounted = useRef(false)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	async function promoteCommit() {
		if (!payload.pendingCommit || busyRef.current) return
		await submit(
			{
				action: 'approve-publish',
				packageId: payload.package.id,
				commit: payload.pendingCommit,
			},
			payload.packageHref,
		)
	}
	async function submit(body: Record<string, unknown>, destination: string) {
		if (busyRef.current) return
		busyRef.current = true
		setBusy(true)
		setMessage(null)
		const isCurrent = capture()
		try {
			await mutation.submit(body)
			if (isCurrent()) await router.navigate({ to: destination })
		} catch (error) {
			if (isCurrent())
				setMessage(
					error instanceof Error
						? error.message
						: 'Unable to approve these changes.',
				)
		} finally {
			busyRef.current = false
			if (mounted.current) setBusy(false)
		}
	}
	return (
		<AccountManagementShell busy={busy}>
			<AccountPageHeader
				title={
					payload?.package.lockedAt ? 'Approve package publish' : 'Publish HEAD'
				}
				description={
					payload?.package.lockedAt
						? 'Review the files that changed since the last publish, then promote this commit. The package stays locked.'
						: 'Review the files that changed since the last publish, then publish default-branch HEAD. Runtime keeps using the published commit until you do.'
				}
				currentHref={currentHref}
			/>
			{message ? (
				<AccountManagementMessage tone="error">
					{message}
				</AccountManagementMessage>
			) : null}

			{payload ? (
				<section
					data-testid="package-approve-publish-card"
					css={getAccentCalloutCss()}
				>
					<div css={{ display: 'grid', gap: spacing.xs }}>
						<h2
							css={{
								margin: 0,
								fontSize: typography.fontSize.lg,
								fontWeight: typography.fontWeight.semibold,
								color: colors.text,
							}}
						>
							{payload.package.name}
						</h2>
						<p css={{ margin: 0, color: colors.textMuted }}>
							{payload.package.lockedAt
								? 'This package is locked. Promoting a commit does not unlock it.'
								: 'This package is not locked. Lock it from the package page if you want later publishes to require approval.'}
						</p>
					</div>
					<MetadataGrid
						items={[
							{
								label: 'Kody id',
								value: (
									<IdValue value={payload.package.kodyId} label="Kody id" />
								),
							},
							{
								label: 'Current published commit',
								value: payload.publishedCommit ? (
									<IdValue
										value={payload.publishedCommit}
										label="published commit"
									/>
								) : (
									'None'
								),
							},
							{
								label: payload.package.lockedAt
									? 'Commit to promote'
									: 'HEAD to publish',
								value: payload.pendingCommit ? (
									<IdValue
										value={payload.pendingCommit}
										label="pending commit"
									/>
								) : (
									'No unpublished commit'
								),
							},
						]}
					/>
					<div
						css={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: spacing.xs,
						}}
					>
						{payload.alreadyPublished || !payload.pendingCommit ? (
							<SiteLink
								href={payload.packageHref}
								css={{
									...getPillButtonCss({ size: 'sm' }),
									display: 'inline-flex',
									textDecoration: 'none',
								}}
							>
								Back to package
							</SiteLink>
						) : (
							<>
								<button
									type="button"
									data-testid="approve-package-publish"
									disabled={busy}
									css={getPillButtonCss({ size: 'sm' })}
									onClick={() => void promoteCommit()}
								>
									{busy
										? payload.package.lockedAt
											? 'Promoting…'
											: 'Publishing…'
										: payload.package.lockedAt
											? 'Promote this commit'
											: 'Publish HEAD'}
								</button>
								<SiteLink
									href={payload.packageHref}
									css={{
										...getGhostButtonCss({ size: 'sm' }),
										display: 'inline-flex',
										textDecoration: 'none',
									}}
								>
									Cancel
								</SiteLink>
							</>
						)}
						<SiteLink
							href={payload.filesHref}
							css={{
								...getGhostButtonCss({ size: 'sm' }),
								display: 'inline-flex',
								textDecoration: 'none',
							}}
						>
							Browse published files
						</SiteLink>
					</div>
					<section
						data-testid="package-publish-diff"
						css={{ display: 'grid', gap: spacing.sm }}
					>
						<h3
							css={{
								margin: 0,
								fontSize: typography.fontSize.base,
								fontWeight: typography.fontWeight.semibold,
								color: colors.text,
							}}
						>
							{payload.alreadyPublished
								? 'No unpublished changes'
								: payload.diff.files.length === 0
									? 'Could not load a file diff for these commits'
									: `${payload.diff.files.length} file${payload.diff.files.length === 1 ? '' : 's'} changed`}
						</h3>
						{payload.diff.omittedCount > 0 ? (
							<p css={{ margin: 0, color: colors.textMuted }}>
								{payload.diff.omittedCount} more file
								{payload.diff.omittedCount === 1 ? '' : 's'} omitted.
							</p>
						) : null}
						{payload.diff.files.map((file) => (
							<details
								key={file.path}
								data-testid="package-publish-diff-file"
								data-status={file.status}
								css={diffFileCss}
							>
								<summary css={diffSummaryCss}>
									<span css={diffStatusCss}>{file.status}</span>
									<code>{file.path}</code>
								</summary>
								{file.patch ? (
									<pre css={diffPatchCss}>{file.patch}</pre>
								) : (
									<p css={{ margin: 0, color: colors.textMuted }}>
										Preview unavailable for this file.
									</p>
								)}
							</details>
						))}
					</section>
				</section>
			) : null}
		</AccountManagementShell>
	)
}

const diffFileCss: CSSObject = {
	margin: 0,
	borderRadius: '0.55rem',
	border: `1px solid ${colors.border}`,
	backgroundColor: colors.background,
}

const diffSummaryCss: CSSObject = {
	display: 'flex',
	alignItems: 'center',
	gap: spacing.xs,
	padding: `${spacing.xs} ${spacing.sm}`,
	cursor: 'pointer',
	color: colors.text,
	'& code': {
		font: `500 0.85rem/1.3 ${typography.fontFamilyMono}`,
	},
}

const diffStatusCss: CSSObject = {
	flexShrink: 0,
	fontSize: typography.fontSize.xs,
	fontWeight: typography.fontWeight.semibold,
	textTransform: 'uppercase' as const,
	letterSpacing: '0.04em',
	color: colors.textMuted,
}

const diffPatchCss: CSSObject = {
	margin: 0,
	padding: spacing.sm,
	overflowX: 'auto' as const,
	borderTop: `1px solid ${colors.border}`,
	font: `400 0.78rem/1.45 ${typography.fontFamilyMono}`,
	whiteSpace: 'pre-wrap' as const,
	color: colors.text,
}

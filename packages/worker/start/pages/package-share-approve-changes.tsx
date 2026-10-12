/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { type CSSObject } from '@emotion/react'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useLocation } from '@tanstack/react-router'
import { routes } from '#universal/routes.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { SiteLink } from '../components/site-link.tsx'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
import { type PackageShareApproveChangesLoaderData } from '#universal/loader-data.ts'
export function PackageShareApproveChangesRoute({
	payload,
	username,
	kodyId,
}: {
	payload: PackageShareApproveChangesLoaderData
	username: string
	kodyId: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshRoute: true,
	})
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
	const reviewBlocked = payload.files.some((file) => file.truncated)
	async function approve(switchToFollow: boolean) {
		await submit(
			routes.communityPackageApproveChangesApi.href({ username, kodyId }),
			{ switchToFollow },
			payload.grant.packagePath,
		)
	}
	async function submit(href: string, body: unknown, destination: string) {
		if (busyRef.current) return
		busyRef.current = true
		setBusy(true)
		setMessage(null)
		try {
			const response = await fetch(href, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			})
			if (!mounted.current) return
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const next = (await response.json()) as { ok?: boolean; error?: string }
			if (!response.ok || !next.ok)
				throw new Error(next.error ?? 'Unable to approve these changes.')
			await invalidatePages()
			if (mounted.current) await router.navigate({ to: destination })
		} catch (error) {
			if (mounted.current)
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
				title="Approve shared package changes"
				description="Review the published source that moved ahead of your pin, then accept it."
				currentHref={currentHref}
			/>
			{message ? (
				<AccountManagementMessage>{message}</AccountManagementMessage>
			) : null}
			{payload ? (
				<>
					<p css={metaCss}>
						{payload.grant.packageName} · accepted{' '}
						<code>{payload.acceptedCommit.slice(0, 7)}</code> → current{' '}
						<code>{payload.currentCommit.slice(0, 7)}</code>
					</p>
					{reviewBlocked ? (
						<AccountManagementMessage>
							One or more files were truncated, so this pin cannot be approved
							here. You can still switch the grant to follow, or ask the owner
							to split the source.
						</AccountManagementMessage>
					) : null}
					<div css={actionsCss}>
						<button
							type="button"
							disabled={busy || reviewBlocked}
							css={getPillButtonCss()}
							onClick={() => void approve(false)}
						>
							Approve this version
						</button>
						<button
							type="button"
							disabled={busy}
							css={getGhostButtonCss()}
							onClick={() => void approve(true)}
						>
							Approve and follow future publishes
						</button>
						<SiteLink href={payload.grant.packagePath}>
							Back to package
						</SiteLink>
					</div>
					{payload.files.length === 0 ? (
						<p>No file-level source differences were available.</p>
					) : (
						payload.files.map((file) => (
							<section key={file.path} css={fileCss}>
								<h2>
									{file.change} · {file.path}
									{file.truncated ? ' · truncated' : ''}
								</h2>
								{file.accepted ? (
									<>
										<h3>Accepted version</h3>
										<pre>
											<code>{file.accepted}</code>
										</pre>
									</>
								) : null}
								{file.current ? (
									<>
										<h3>Current version</h3>
										<pre>
											<code>{file.current}</code>
										</pre>
									</>
								) : null}
							</section>
						))
					)}
				</>
			) : (
				<p>Loading the published diff…</p>
			)}
		</AccountManagementShell>
	)
}

const metaCss: CSSObject = {
	color: colors.textMuted,
	'& code': {
		font: '500 0.88rem/1.2 ui-monospace, "SF Mono", Menlo, monospace',
	},
}

const actionsCss: CSSObject = {
	display: 'flex',
	flexWrap: 'wrap' as const,
	gap: spacing.sm,
	margin: `${spacing.lg} 0`,
	'& a': {
		alignSelf: 'center',
		color: colors.primaryText,
	},
}

const fileCss: CSSObject = {
	marginTop: spacing.xl,
	'& h2': {
		margin: `0 0 ${spacing.sm}`,
		fontSize: '1rem',
	},
	'& h3': {
		margin: `${spacing.md} 0 ${spacing.xs}`,
		fontSize: '0.88rem',
		color: colors.textMuted,
	},
	'& pre': {
		overflow: 'auto',
		padding: spacing.md,
		border: `1px solid ${colors.border}`,
		borderRadius: '0.5rem',
		background: colors.surface,
		fontSize: '0.82rem',
	},
}

const mutationResources = [
	'loadPackage',
	'loadPackageFiles',
	'loadSharedPage',
	'loadProfile',
] as const

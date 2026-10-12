/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { type CSSObject } from '@emotion/react'
import { useRef, useState } from 'react'
import { SiteLink } from '../components/site-link.tsx'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { type AccountSharedLoaderData } from '#universal/loader-data.ts'
import { type PackageShareGrantLoaderView } from '#universal/package-share.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { postPackageShareAction } from '../../client/routes/package-share-client.ts'

export function AccountSharedPage({
	payload: data,
	currentHref,
}: {
	payload: AccountSharedLoaderData
	currentHref: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const [message, setMessage] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const busyRef = useRef(false)
	async function runAction(
		input: Parameters<typeof postPackageShareAction>[0],
	) {
		if (busyRef.current) return
		busyRef.current = true
		setBusy(true)
		setMessage(null)
		try {
			const result = await postPackageShareAction(input)
			if (result.status === 'unauthorized') {
				window.location.assign('/login')
				return
			}
			if (result.status === 'error') {
				setMessage(result.message)
				return
			}
			await invalidatePages()
		} catch {
			setMessage('Unable to update shared packages. Please try again.')
		} finally {
			busyRef.current = false
			setBusy(false)
		}
	}
	return (
		<AccountManagementShell busy={busy}>
			<AccountPageHeader
				title="Shared"
				description="Packages you have shared, and packages shared with you."
				currentHref={currentHref}
			/>
			{message ? (
				<AccountManagementMessage>{message}</AccountManagementMessage>
			) : null}
			<AccountManagementPanel>
				<h2 css={headingCss}>Shared with you</h2>
				<GrantList
					{...{
						grants: data?.inbound ?? [],
						empty: 'Nothing is shared with you yet.',
						busy,
						guest: true,
						onAccept: (grant, trustLevel) =>
							void runAction({
								intent: 'accept',
								grantId: grant.id,
								trustLevel,
							}),
						onLeave: (grant) =>
							void runAction({ intent: 'leave', grantId: grant.id }),
					}}
				/>
			</AccountManagementPanel>
			<AccountManagementPanel>
				<h2 css={headingCss}>Shared by you</h2>
				<GrantList
					{...{
						grants: data?.outbound ?? [],
						empty: 'You have not shared a package yet.',
						busy,
						guest: false,
						onRevoke: (grant) =>
							void runAction({ intent: 'revoke', grantId: grant.id }),
					}}
				/>
			</AccountManagementPanel>
		</AccountManagementShell>
	)
}

function GrantList(input: {
	grants: Array<PackageShareGrantLoaderView>
	empty: string
	busy: boolean
	guest: boolean
	onAccept?: (
		grant: PackageShareGrantLoaderView,
		trustLevel: 'follow' | 'pin',
	) => void
	onLeave?: (grant: PackageShareGrantLoaderView) => void
	onRevoke?: (grant: PackageShareGrantLoaderView) => void
}) {
	const visible = input.grants.filter(
		(grant) => grant.status === 'pending' || grant.status === 'accepted',
	)
	if (visible.length === 0) {
		return <p css={emptyCss}>{input.empty}</p>
	}
	return (
		<ul css={listCss}>
			{visible.map((grant) => (
				<li key={grant.id}>
					<div>
						<SiteLink href={grant.packagePath}>{grant.packageName}</SiteLink>
						<span>
							{grant.status}
							{grant.trustLevel ? ` · ${grant.trustLevel}` : ''}
							{grant.pinAhead ? ' · pin ahead' : ''}
							{!input.guest && grant.granteeUsername
								? ` · @${grant.granteeUsername}`
								: ''}
							{!input.guest && !grant.granteeUsername && grant.inviteeEmail
								? ` · ${grant.inviteeEmail}`
								: ''}
						</span>
					</div>
					<div css={actionsCss}>
						{input.guest && grant.status === 'pending' ? (
							<>
								<button
									type="button"
									disabled={input.busy}
									onClick={() => input.onAccept?.(grant, 'pin')}
									css={getPillButtonCss({ size: 'sm' })}
								>
									Accept (pin)
								</button>
								<button
									type="button"
									disabled={input.busy}
									onClick={() => input.onAccept?.(grant, 'follow')}
									css={getGhostButtonCss({ size: 'sm' })}
								>
									Follow
								</button>
							</>
						) : null}
						{input.guest && grant.pinAhead && grant.approveChangesPath ? (
							<SiteLink
								href={grant.approveChangesPath}
								css={getPillButtonCss({ size: 'sm' })}
							>
								Approve changes
							</SiteLink>
						) : null}
						{input.guest && grant.status === 'accepted' ? (
							<button
								type="button"
								disabled={input.busy}
								onClick={() => input.onLeave?.(grant)}
								css={getGhostButtonCss({ size: 'sm' })}
							>
								Leave
							</button>
						) : null}
						{!input.guest ? (
							<button
								type="button"
								disabled={input.busy}
								onClick={() => input.onRevoke?.(grant)}
								css={getGhostButtonCss({ size: 'sm' })}
							>
								Revoke
							</button>
						) : null}
					</div>
				</li>
			))}
		</ul>
	)
}

const headingCss: CSSObject = {
	margin: `0 0 ${spacing.md}`,
	fontSize: '1.05rem',
}

const emptyCss: CSSObject = {
	margin: 0,
	color: colors.textMuted,
}

const listCss: CSSObject = {
	listStyle: 'none',
	margin: 0,
	padding: 0,
	display: 'grid',
	gap: spacing.sm,
	'& li': {
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: spacing.md,
		flexWrap: 'wrap' as const,
	},
	'& a': {
		color: colors.primaryText,
		fontWeight: 550,
		textDecoration: 'none',
	},
	'& span': {
		display: 'block',
		color: colors.textMuted,
		fontSize: '0.88rem',
	},
}

const actionsCss: CSSObject = {
	display: 'flex',
	flexWrap: 'wrap' as const,
	gap: spacing.sm,
}

const mutationResources = [
	'loadSharedPage',
	'loadPackage',
	'loadPackageFiles',
	'loadProfile',
] as const

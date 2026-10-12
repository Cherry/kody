/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { resolvePackageListIconUrl } from '#universal/identity-icon-urls.ts'
import { useEffect, useRef, useState } from 'react'
import { type CommunityDetailApiPayload } from '../community-types.ts'
import { type SessionInfo } from '#client/session.ts'
import {
	type AccountPackageDetail,
	type AccountPackagesLoaderData,
} from '#universal/loader-data.ts'
import { type PackageShareGrantLoaderView } from '#universal/package-share.ts'
import { isFeatureFlagEnabled } from '#client/feature-flags.ts'
import { packageShareGrantsFlagKey } from '#universal/feature-flags/registry.ts'
import { postPackageShareAction } from '#client/routes/package-share-client.ts'
import { renderPackageRepoChrome } from '../components/package-repo-nav.tsx'
import {
	detailArticleCss,
	detailSectionCss,
	renderMissingListing,
} from '../components/community-detail-sections.tsx'
import {
	getPackageTreeHref,
	fallbackDefaultBranchName,
} from '#universal/package-files.ts'
import { AccountPackageOwnerDetails } from './account-package-owner-details.tsx'
import { PackageWebhookSettings } from './package-webhook-settings.tsx'
import {
	loadPackageShareGrants,
	renderPackageShareSettings as PackageShareSettings,
} from './package-share-settings.tsx'
export function PackageSettingsRoute({
	data,
	session,
}: {
	data: CommunityDetailApiPayload
	session: SessionInfo | null
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshRoute: true,
	})
	const mounted = useRef(false),
		busyRef = useRef(false)
	const [ownerPackage, setOwnerPackage] = useState<AccountPackageDetail | null>(
		data.ownerPackage ?? null,
	)
	const [lockBusy, setLockBusy] = useState(false),
		[message, setMessage] = useState<string | null>(null)
	const [grants, setGrants] = useState<PackageShareGrantLoaderView[]>([]),
		[inviteUsername, setInviteUsername] = useState(''),
		[inviteEmail, setInviteEmail] = useState(''),
		[shareBusy, setShareBusy] = useState(false),
		[shareMessage, setShareMessage] = useState<string | null>(null)
	const username = data.username,
		kodyId = data.kodyId
	const shareEnabled = isFeatureFlagEnabled(session, packageShareGrantsFlagKey)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const [snapshot, setSnapshot] = useState(data.ownerPackage)
	if (snapshot !== data.ownerPackage) {
		setSnapshot(data.ownerPackage)
		setOwnerPackage(data.ownerPackage ?? null)
	}
	const hasOwner = ownerPackage !== null

	useEffect(() => {
		let active = true
		if (shareEnabled && hasOwner)
			void loadPackageShareGrants({ username, kodyId })
				.then((next) => {
					if (active) setGrants(next)
				})
				.catch(() => {
					if (active)
						setShareMessage('Unable to load who this package is shared with.')
				})
		return () => {
			active = false
		}
	}, [username, kodyId, shareEnabled, hasOwner])
	function apply(payload: AccountPackagesLoaderData) {
		if (payload.selectedPackage?.id === ownerPackage?.id)
			setOwnerPackage(payload.selectedPackage)
		void invalidatePages()
	}
	async function toggleLock() {
		if (!ownerPackage || busyRef.current) return
		busyRef.current = true
		setLockBusy(true)
		setMessage(null)
		const previous = ownerPackage
		const locked = !ownerPackage.lockedAt
		setOwnerPackage({
			...ownerPackage,
			lockedAt: locked ? new Date().toISOString() : null,
		})
		try {
			const response = await fetch('/account/packages.json', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					action: locked ? 'lock' : 'unlock',
					packageId: previous.id,
				}),
			})
			if (!mounted.current) return
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = (await response.json()) as AccountPackagesLoaderData & {
				error?: string
			}
			if (!response.ok || !payload.ok)
				throw new Error(payload.error ?? 'Could not update the publish lock.')
			apply(payload)
		} catch (error) {
			if (mounted.current) {
				setOwnerPackage(previous)
				setMessage(
					error instanceof Error
						? error.message
						: 'Could not update the publish lock.',
				)
			}
		} finally {
			busyRef.current = false
			if (mounted.current) setLockBusy(false)
		}
	}
	async function share(intent: 'invite' | 'revoke', grantId?: string) {
		if (busyRef.current) return
		busyRef.current = true
		setShareBusy(true)
		setShareMessage(null)
		try {
			const result = await postPackageShareAction({
				intent,
				ownerUsername: username,
				kodyId,
				grantId,
				username: inviteUsername,
				email: inviteEmail,
			})
			if (!mounted.current) return
			if (result.status === 'unauthorized') {
				window.location.assign('/login')
				return
			}
			if (result.status === 'error') {
				setShareMessage(result.message)
				return
			}
			if (intent === 'invite') {
				setInviteUsername('')
				setInviteEmail('')
			}
			const next = await loadPackageShareGrants({ username, kodyId })
			if (mounted.current) setGrants(next)
			void invalidatePages()
		} catch {
			if (mounted.current)
				setShareMessage('Unable to update who this package is shared with.')
		} finally {
			busyRef.current = false
			if (mounted.current) setShareBusy(false)
		}
	}
	if (!ownerPackage)
		return renderMissingListing('Not found', 'This package is not available.')
	return (
		<article css={detailArticleCss} data-testid="package-settings">
			{renderPackageRepoChrome({
				username,
				kodyId,
				isPrivate: ownerPackage.isPrivate,
				isListed: ownerPackage.hasCommunityListing,
				viewerIsOwner: true,
				active: 'settings',
				filesHref: getPackageTreeHref({
					username,
					kodyId,
					listingId: data.listing?.id ?? null,
					ref: data.listing?.defaultBranch || fallbackDefaultBranchName,
				}),
				description: ownerPackage.description ?? '',
				ownerProfilePublic: data.ownerProfilePublic,
				iconUrl: resolvePackageListIconUrl({
					username,
					kodyId,
					listingId: data.listing?.id ?? null,
					listingIconCommit: null,
					publishedCommit: ownerPackage.publishedCommit ?? null,
				}),
				iconName: kodyId,
			})}
			<section
				aria-labelledby="package-owner-details-title"
				css={detailSectionCss}
			>
				<h2 id="package-owner-details-title">Package details</h2>
				{message ? <p role="alert">{message}</p> : null}
				<AccountPackageOwnerDetails
					ownerUsername={username}
					packageDetail={ownerPackage}
					lockInFlight={lockBusy}
					onToggleLock={() => void toggleLock()}
					onPackagesPayload={apply}
				/>
			</section>
			<PackageWebhookSettings
				key={`${username}/${kodyId}`}
				username={username}
				kodyId={kodyId}
			/>
			{shareEnabled ? (
				<PackageShareSettings
					{...{
						username,
						kodyId,
						grants,
						inviteUsername,
						inviteEmail,
						busy: shareBusy,
						message: shareMessage,
						onInviteUsername: setInviteUsername,
						onInviteEmail: setInviteEmail,
						onInvite: () => void share('invite'),
						onRevoke: (id) => void share('revoke', id),
					}}
				/>
			) : null}
		</article>
	)
}

const mutationResources = [
	'loadPackage',
	'loadPackageFiles',
	'loadProfile',
	'loadCommunity',
	'loadSharedPage',
] as const

/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { resolvePackageListIconUrl } from '#universal/identity-icon-urls.ts'
import { useEffect, useRef, useState } from 'react'
import { type CommunityDetailApiPayload } from '../community-types.ts'
import {
	type AccountPackageDetail,
	type AccountPackagesLoaderData,
} from '#universal/loader-data.ts'
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
export function PackageSettingsRoute({
	data,
}: {
	data: CommunityDetailApiPayload
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
	const username = data.username,
		kodyId = data.kodyId
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
	if (!ownerPackage)
		return renderMissingListing('Not found', 'This package is not available.')
	return (
		<article css={detailArticleCss} data-testid="package-settings">
			{renderPackageRepoChrome({
				username,
				kodyId,
				isPrivate: ownerPackage.isPrivate,
				isListed: ownerPackage.hasCommunityListing,
				viewerIsOwner: data.viewerIsOwner,
				viewerCanManage: data.viewerCanManage,
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
		</article>
	)
}

const mutationResources = [
	'loadPackage',
	'loadPackageFiles',
	'loadProfile',
	'loadCommunity',
] as const

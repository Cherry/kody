/** @jsxImportSource @emotion/react */
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { resolvePackageListIconUrl } from '#universal/identity-icon-urls.ts'
import { useState } from 'react'
import { type CommunityDetailApiPayload } from '../community-types.ts'
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
import { PackageCreditAttributionPanel } from './account-usage-where-it-went.tsx'
import { PackageWebhookSettings } from './package-webhook-settings.tsx'
export function PackageSettingsRoute({
	data,
}: {
	data: CommunityDetailApiPayload
}) {
	const ownerPackage = data.ownerPackage ?? null
	const capture = useSubmitterScope()
	const lock = usePackageMutation(ownerPackage?.id ?? '')
	const [message, setMessage] = useState<string | null>(null)
	const username = data.username,
		kodyId = data.kodyId
	const lockBusy = lock.pendingAction !== undefined
	const optimisticLockedAt =
		lock.pendingAction === 'lock'
			? lock.pendingLockedAt
			: lock.pendingAction === 'unlock'
				? null
				: ownerPackage?.lockedAt
	async function toggleLock() {
		if (!ownerPackage || lockBusy) return
		setMessage(null)
		const isCurrent = capture()
		try {
			await lock.submit({ action: ownerPackage.lockedAt ? 'unlock' : 'lock' })
		} catch (error) {
			if (!isCurrent()) return
			setMessage(
				error instanceof Error
					? error.message
					: 'Could not update the publish lock.',
			)
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
				{ownerPackage.creditAttribution ? (
					<PackageCreditAttributionPanel row={ownerPackage.creditAttribution} />
				) : null}
				<AccountPackageOwnerDetails
					ownerUsername={username}
					viewerCanPublish={data.viewerCanPublish === true}
					viewerCanDelete={data.viewerCanDelete === true}
					viewerCanAdoptCommunityFork={
						data.viewerCanAdoptCommunityFork === true
					}
					packageDetail={{
						...ownerPackage,
						lockedAt: optimisticLockedAt ?? null,
					}}
					lockInFlight={lockBusy}
					onToggleLock={() => void toggleLock()}
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

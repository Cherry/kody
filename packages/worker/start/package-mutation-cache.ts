import {
	lockPackage,
	unlockPackage,
	approvePackagePublish,
	setPackageVisibility,
	setPackageInternetVisible,
	approvePackageCapabilities,
	approvePackageCapabilitiesAndGoPublic,
	approvePackageCredentialNeeds,
	approvePackageWentPublic,
	deletePackage,
	adoptPackageFork,
	absorbPackageListing,
} from '#start/server/package-mutations'
import {
	mutationOptions,
	type QueryClient,
	type Query,
} from '@tanstack/react-query'
import { type loadPackage } from '#start/server/public-data'
import {
	type AccountPackageListingBehindHint,
	type AccountPackagesLoaderData,
} from '#universal/loader-data.ts'
import { invalidatePageResources } from './page-invalidation-cache.ts'
type PackagePage = Awaited<ReturnType<typeof loadPackage>>
type PackageResult = AccountPackagesLoaderData & {
	listing?: AccountPackageListingBehindHint | null
	error?: string
	approvalUrl?: string
	deleted?: boolean
}
export type PackageWrite =
	| { action: 'lock' | 'unlock' | 'absorb-listing' }
	| { action: 'approve-publish'; commit: string }
	| {
			action: 'set-visibility'
			visibility: 'public' | 'private'
			confirmName: string
	  }
	| {
			action: 'set-internet-visible'
			internetVisible: boolean
			confirmName: string
	  }
	| { action: 'approve-capabilities'; fingerprint: string }
	| {
			action: 'approve-capabilities-and-go-public'
			fingerprint: string
			requestId: string
	  }
	| {
			action: 'approve-credential-needs' | 'approve-went-public'
			requestId: string
	  }
	| { action: 'delete'; confirmName: string }
	| { action: 'adopt-community-fork'; reviewNote: string }
async function writePackage(packageId: string, input: PackageWrite) {
	switch (input.action) {
		case 'lock':
			return lockPackage({ data: { packageId } })
		case 'unlock':
			return unlockPackage({ data: { packageId } })
		case 'absorb-listing':
			return absorbPackageListing({ data: { packageId } })
		case 'approve-publish':
			return approvePackagePublish({
				data: { packageId, commit: input.commit },
			})
		case 'set-visibility':
			return setPackageVisibility({
				data: {
					packageId,
					visibility: input.visibility,
					confirmName: input.confirmName,
				},
			})
		case 'set-internet-visible':
			return setPackageInternetVisible({
				data: {
					packageId,
					internetVisible: input.internetVisible,
					confirmName: input.confirmName,
				},
			})
		case 'approve-capabilities':
			return approvePackageCapabilities({
				data: { packageId, fingerprint: input.fingerprint },
			})
		case 'approve-capabilities-and-go-public':
			return approvePackageCapabilitiesAndGoPublic({
				data: {
					packageId,
					fingerprint: input.fingerprint,
					requestId: input.requestId,
				},
			})
		case 'approve-credential-needs':
			return approvePackageCredentialNeeds({
				data: { packageId, requestId: input.requestId },
			})
		case 'approve-went-public':
			return approvePackageWentPublic({
				data: { packageId, requestId: input.requestId },
			})
		case 'delete':
			return deletePackage({
				data: { packageId, confirmName: input.confirmName },
			})
		case 'adopt-community-fork':
			return adoptPackageFork({
				data: { packageId, reviewNote: input.reviewNote },
			})
	}
}
export function packageMutationOptions(client: QueryClient) {
	function packageQueries(actorKey: string | null, packageId: string) {
		return {
			queryKey: ['page', actorKey, 'loadPackage'],
			predicate: (query: Query) => {
				const page = query.state.data as PackagePage | undefined
				return page?.kind === 'page' && page.data.ownerPackage?.id === packageId
			},
		}
	}
	return mutationOptions({
		retry: false,
		gcTime: 0,
		mutationFn: async (input: {
			body: PackageWrite
			actorKey: string | null
			packageId: string
		}) => {
			const payload = (await writePackage(
				input.packageId,
				input.body,
			)) as PackageResult
			if (!payload.ok)
				throw Object.assign(
					new Error(payload.error || 'Unable to update this package.'),
					{ approvalUrl: payload.approvalUrl },
				)
			return payload
		},
		onSuccess: async (accepted, input) => {
			await client.cancelQueries(
				packageQueries(input.actorKey, input.packageId),
			)
			if (accepted.selectedPackage?.id === input.packageId) {
				const selectedPackage = accepted.selectedPackage
				client.setQueriesData<PackagePage>(
					{ queryKey: ['page', input.actorKey, 'loadPackage'] },
					(page) =>
						page?.kind === 'page' &&
						page.data.ownerPackage?.id === input.packageId
							? {
									...page,
									data: { ...page.data, ownerPackage: selectedPackage },
								}
							: page,
				)
			}
		},
		onSettled: (_data, _error, input) => {
			// Reconcile accepted writes and uncertain network failures after any unmount.
			if (input.body.action === 'lock' || input.body.action === 'unlock') {
				void client.invalidateQueries(
					packageQueries(input.actorKey, input.packageId),
				)
				return
			}
			void invalidatePageResources(
				client,
				input.actorKey,
				['loadPackage', 'loadPackageFiles', 'loadProfile', 'loadCommunity'],
				input.body.action === 'delete' ? 'none' : 'active',
			)
		},
	})
}

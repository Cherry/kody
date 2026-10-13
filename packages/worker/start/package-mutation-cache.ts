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
			body: Record<string, unknown>
			actorKey: string | null
			packageId: string
			apiPath?: string
		}) => {
			const response = await fetch(input.apiPath ?? '/account/packages.json', {
				method: 'POST',
				credentials: 'include',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ...input.body, packageId: input.packageId }),
			})
			const payload = (await response
				.json()
				.catch(() => null)) as PackageResult | null
			if (!response.ok || !payload?.ok)
				throw Object.assign(
					new Error(
						payload?.error ||
							(response.status === 401
								? 'Please sign in again.'
								: 'Unable to update this package.'),
					),
					{ approvalUrl: payload?.approvalUrl },
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

import { type QueryClient } from '@tanstack/react-query'
import { type AccountValuesLoaderData } from '#universal/loader-data.ts'
import { scopedPageResource, type PageOrgScope } from '../page-query-scope.ts'

export type ValuesQueryData = { payload: AccountValuesLoaderData }

export function valuesMutationOptions(
	client: QueryClient,
	actorKey: string | null,
	send: (action: {
		name: string
		orgSlug: string | null
	}) => Promise<AccountValuesLoaderData>,
	scope: PageOrgScope = { orgSlug: null },
) {
	return {
		mutationKey: ['values', actorKey, scope.orgSlug] as const,
		mutationFn: send,
		onSuccess: async (
			accepted: AccountValuesLoaderData,
			{ name, orgSlug }: { name: string; orgSlug: string | null },
		) => {
			const resource = scopedPageResource(actorKey, 'loadValuesPage', {
				orgSlug,
			})
			// Cancel reads started before the accepted deletion, including reads
			// started after the submitting page unmounted.
			await client.cancelQueries({
				...resource,
				predicate: (query) =>
					resource.predicate(query) && query.state.data !== undefined,
			})
			client.setQueriesData<ValuesQueryData>(resource, (data) => {
				if (!data) return data
				const selected = data.payload.selectedValue
				return {
					...data,
					payload: {
						...data.payload,
						values: accepted.values,
						selectedValue:
							selected?.name === name ||
							!accepted.values.some((value) => value.id === selected?.id)
								? null
								: selected,
					},
				}
			})
			// The response proves the complete list, but does not include unrelated
			// selected details or usage totals.
			void client.invalidateQueries({
				...resource,
				predicate: (query) =>
					resource.predicate(query) &&
					Boolean(
						(query.state.data as ValuesQueryData | undefined)?.payload
							.selectedValue,
					),
				refetchType: 'none',
			})
			void client.invalidateQueries({
				...scopedPageResource(actorKey, 'loadUsagePage', { orgSlug }),
			})
		},
	}
}

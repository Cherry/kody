import { useMatchedPageScope } from './use-matched-page-scope.ts'
import { useSubmitterScope } from './use-submitter-scope.ts'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { acceptedPageMutationOptions } from './accepted-page-mutation.ts'
import { type PageResource } from './page-resources.ts'
import { type PageMutationDependencies } from './page-invalidation-cache.ts'

class MutationAuthenticationError extends Error {}

export function usePageResponseMutation<
	TResponse extends { ok?: boolean; error?: string },
>(
	queryKey: QueryKey,
	resource: PageResource,
	apiPath: string,
	options: {
		dependencyScope?: 'actor' | 'org'
		dependencies?: PageMutationDependencies
		refreshShell?: boolean
		merge?: (
			page: { payload: TResponse; [key: string]: unknown },
			accepted: TResponse,
		) => { payload: TResponse; [key: string]: unknown }
	} = {},
) {
	const client = useQueryClient()
	const { actorKey, pageLocation } = useMatchedPageScope()
	const href = pageLocation.href
	const captureSubmitter = useSubmitterScope()

	const mutation = useMutation(
		acceptedPageMutationOptions<Record<string, unknown>, TResponse>(client, {
			resource,
			...options,
			send: async ({ body, href, apiPath: submittedApiPath }) => {
				if (!submittedApiPath) throw new Error('Missing mutation endpoint')
				const response = await fetch(submittedApiPath, {
					method: 'POST',
					referrer: orgAccountApiReferrer(href),
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					body: JSON.stringify(body),
				})
				if (response.status === 401)
					throw new MutationAuthenticationError('Please sign in again.')

				const payload = (await response.json()) as TResponse
				if (!response.ok || !payload.ok)
					throw new Error(payload.error || 'Unable to save changes.')
				return payload
			},
		}),
	)
	return {
		...mutation,
		submit: (body: Record<string, unknown>) => {
			const isCurrentSubmitter = captureSubmitter()
			return mutation
				.mutateAsync({ body, actorKey, href, queryKey, apiPath })
				.catch((error) => {
					if (
						error instanceof MutationAuthenticationError &&
						isCurrentSubmitter()
					)
						window.location.assign(
							`/login?redirectTo=${encodeURIComponent(href)}`,
						)
					throw error
				})
		},
	}
}

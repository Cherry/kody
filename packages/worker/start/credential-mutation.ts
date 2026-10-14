import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { pageQueryOrg } from './page-query-scope.ts'

/** Credential writes invalidate only the submitting actor and organization. */
export function useCredentialMutation<TInput, TResult>(
	href: string,
	send: (input: TInput) => Promise<TResult>,
) {
	const client = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const scopeOrg = (value: string) =>
		pageQueryOrg(value) ??
		/^\/@([^/]+)\//.exec(new URL(value, 'https://kody.local').pathname)?.[1] ??
		null
	const org = scopeOrg(href)
	return useMutation({
		mutationKey: ['credentials', actorKey, org],
		mutationFn: send,
		onMutate: () => ({ actorKey, org }),
		onSettled: async (_data, _error, _variables, submitted) => {
			if (!submitted) return
			await client.invalidateQueries({
				predicate: ({ queryKey }) =>
					queryKey[0] === 'page' &&
					queryKey[1] === submitted.actorKey &&
					[
						'loadCredentialsPage',
						'loadPackageCredentialsPage',
						'loadSecretsPage',
						'loadJobsPage',
						'loadWorkflowsPage',
						'loadWebhooksPage',
					].includes(String(queryKey[2])) &&
					(typeof queryKey[3] !== 'string' ||
						scopeOrg(queryKey[3]) === submitted.org),
			})
		},
	})
}
export function credentialPost(href: string, apiPath: string, body: unknown) {
	return fetch(apiPath, {
		method: 'POST',
		credentials: 'include',
		referrer: orgAccountApiReferrer(href),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
}

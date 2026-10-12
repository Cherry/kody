import {
	mutationOptions,
	type QueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import {
	postPackageWebhookIntent,
	type WebhookIntent,
	webhookFailureMessage,
} from '#client/routes/webhooks-shared.ts'

export function packageWebhookMutationOptions(queryClient: QueryClient) {
	return mutationOptions({
		gcTime: 0,
		mutationFn: async (input: {
			username: string
			kodyId: string
			webhookName: string
			webhookId: string
			intent: WebhookIntent
			queryKey: QueryKey
			invalidate: () => Promise<void>
		}) => {
			const result = await postPackageWebhookIntent(input)
			if (result.kind === 'unauthorized')
				throw new Error('Sign in again to manage webhooks.')
			if (result.kind === 'error')
				throw new Error(result.message || webhookFailureMessage(input.intent))
			return result.payload
		},
		onMutate: async ({ queryKey }) => {
			await queryClient.cancelQueries({ queryKey, exact: true })
		},
		onSuccess: async (accepted, input) => {
			await queryClient.cancelQueries({ queryKey: input.queryKey, exact: true })
			// Never place revealed credential URLs in the shared query cache.
			const { revealed: _revealed, ...safePayload } = accepted
			queryClient.setQueryData(input.queryKey, safePayload)
			void input.invalidate()
		},
		onError: (_error, { queryKey }) => {
			void queryClient.invalidateQueries({ queryKey, exact: true })
		},
	})
}

import {
	useMutation,
	useQueryClient,
	useMutationState,
} from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import {
	packageMutationOptions,
	type PackageWrite,
} from './package-mutation-cache.ts'
export function usePackageMutation(packageId: string) {
	const client = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const pending = useMutationState({
		filters: {
			mutationKey: ['package', actorKey, packageId],
			status: 'pending',
		},
		select: (mutation) => ({
			...(mutation.state.variables as { body: PackageWrite }),
			submittedAt: mutation.state.submittedAt,
		}),
	})
	const mutation = useMutation({
		...packageMutationOptions(client),
		mutationKey: ['package', actorKey, packageId],
	})
	return {
		...mutation,
		pendingAction: pending.at(-1)?.body.action,
		pendingLockedAt: pending.length
			? new Date(pending.at(-1)!.submittedAt).toISOString()
			: null,
		submit: (body: PackageWrite) =>
			mutation.mutateAsync({ body, actorKey, packageId }),
	}
}

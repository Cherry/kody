import { useMatchedPageScope } from './use-matched-page-scope.ts'
import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import {
	invalidatePageResources,
	type PageMutationDependencies,
} from './page-invalidation-cache.ts'
import { invalidateShellQueries } from './shell-query.ts'

export function usePageInvalidation(
	resources: PageMutationDependencies,
	{
		refreshShell = false,
		refreshRoute = false,
	}: {
		refreshShell?: boolean
		/** Action loaders and mutable head metadata still belong to Router. */
		refreshRoute?: boolean
	} = {},
) {
	const queryClient = useQueryClient()
	const router = useRouter()
	const { actorKey, pageLocation } = useMatchedPageScope()
	const href = pageLocation.href
	return useCallback(async () => {
		// One owner initiates active reads. Starting both Router and Query
		// refreshes races authorization loaders and can cancel/restart GETs.
		await invalidatePageResources(
			queryClient,
			actorKey,
			resources,
			refreshRoute ? 'none' : 'active',
			href,
		)
		const currentContext = router.state.matches[0]?.context
		const isCurrentActor =
			currentContext != null &&
			typeof currentContext === 'object' &&
			'actorKey' in currentContext &&
			currentContext.actorKey === actorKey
		await Promise.all([
			refreshShell ? invalidateShellQueries(queryClient, actorKey) : undefined,
			refreshRoute && router.state.location.href === href && isCurrentActor
				? router.invalidate({ filter: (match) => match.routeId !== '__root__' })
				: undefined,
		])
	}, [
		actorKey,
		queryClient,
		router,
		resources,
		refreshShell,
		refreshRoute,
		href,
	])
}

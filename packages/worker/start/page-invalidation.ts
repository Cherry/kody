import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouteContext, useLocation } from '@tanstack/react-router'
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
	const href = useLocation({ select: (location) => location.href })
	const { actorKey } = useRouteContext({ from: '__root__' })
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
		await Promise.all([
			refreshShell ? invalidateShellQueries(queryClient, actorKey) : undefined,
			refreshRoute &&
			router.state.location.href === href &&
			router.state.matches[0]?.context.actorKey === actorKey
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

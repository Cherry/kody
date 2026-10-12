import { useEffect, useRef } from 'react'
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import {
	useLocation,
	useRouteContext,
	useMatches,
} from '@tanstack/react-router'
import { acceptedPageMutationOptions } from './accepted-page-mutation.ts'
import { type PageResource } from './page-resources.ts'
import { type PageMutationDependencies } from './page-invalidation-cache.ts'

class MutationAuthenticationError extends Error {}

export function usePageResponseMutation<
	TResponse extends { ok?: boolean; error?: string },
>(
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
	const { actorKey } = useRouteContext({ from: '__root__' })
	const href = useLocation({ select: (location) => location.href })
	const submitter = useRef<{ actorKey: string | null; href: string } | null>(
		null,
	)
	useEffect(() => {
		submitter.current = { actorKey, href }
		return () => {
			submitter.current = null
		}
	}, [actorKey, href])
	const queryKey = useMatches({
		select: (matches) => {
			for (const match of [...matches].reverse()) {
				const data: unknown = match.loaderData
				if (!data || typeof data !== 'object' || !('pageHeadQueryKey' in data))
					continue
				const key = data.pageHeadQueryKey
				if (
					Array.isArray(key) &&
					key[0] === 'page' &&
					key[1] === actorKey &&
					key[2] === resource
				)
					return key as QueryKey
			}
			return undefined
		},
	})
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
			if (!queryKey)
				throw new Error(`Missing submitted query key for ${resource}`)
			return mutation
				.mutateAsync({ body, actorKey, href, queryKey, apiPath })
				.catch((error) => {
					if (
						error instanceof MutationAuthenticationError &&
						submitter.current?.actorKey === actorKey &&
						submitter.current.href === href
					)
						window.location.assign(
							`/login?redirectTo=${encodeURIComponent(href)}`,
						)
					throw error
				})
		},
	}
}

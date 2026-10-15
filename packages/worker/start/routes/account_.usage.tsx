/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { rejectActionPageHead } from '../action-page-method.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountUsagePage } from '../pages/account-usage.tsx'
import { loadUsagePage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadUsagePage', loadUsagePage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/account_/usage')({
	server: {
		handlers: {
			HEAD: ({ request, next }) => {
				const search = new URL(request.url).searchParams
				return search.get('topup') === 'success' &&
					search.get('session_id')?.trim()
					? rejectActionPageHead()
					: next()
			},
		},
	},
	loaderDeps: ({ search }) => search,
	context: ({ location }) => {
		const search = new URLSearchParams(location.searchStr)
		return {
			pageQueryInput: {
				credits: search.get('credits'),
				error: search.get('error'),
				topup: search.get('topup'),
				sessionId: search.get('session_id'),
				hash: location.hash,
				navigationSearch: [...search],
			},
		}
	},
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const mutationContext = Route.useRouteContext()
	const mutationQueryKey = pageQuery(
		mutationContext.actorKey,
		mutationContext.pageQueryInput,
	).queryKey
	const { payload } = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return (
		<AccountUsagePage
			queryKey={mutationQueryKey}
			payload={payload}
			currentHref={location.href}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

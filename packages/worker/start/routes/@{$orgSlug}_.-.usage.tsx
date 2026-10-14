/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountUsagePage } from '../pages/account-usage.tsx'
import { loadUsagePage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadUsagePage', loadUsagePage, {
	staleTime: 10_000,
	freshAuthorization: true,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/usage')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		credits: search.credits,
		error: search.error,
		topup: search.topup,
		session_id: search.session_id,
	}),
	context: ({ location, params }) => {
		const search = new URLSearchParams(location.searchStr)
		return {
			pageQueryInput: {
				orgSlug: params.orgSlug,
				credits: search.get('credits'),
				error: search.get('error'),
				topup: search.get('topup'),
				sessionId: search.get('session_id'),
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

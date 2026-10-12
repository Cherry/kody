/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AccountSharedPage } from '../pages/account-shared.tsx'
import { loadSharedPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadSharedPage', loadSharedPage, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/account_/shared')({
	context: ({ location }) => ({
		pageQueryInput: location.pathname + pageSearch(location.searchStr, []),
	}),
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
	const { payload } = usePageData()
	const location = useLocation()
	return <AccountSharedPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

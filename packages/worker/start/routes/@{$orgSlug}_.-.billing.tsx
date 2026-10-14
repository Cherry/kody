/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountBillingPage } from '../pages/account-billing.tsx'
import { loadBillingPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadBillingPage', loadBillingPage)

export const Route = createFileRoute('/@{$orgSlug}_/-/billing')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		billing: search.billing,
		error: search.error,
	}),
	context: ({ location }) => ({
		pageQueryInput:
			location.pathname + pageSearch(location.searchStr, ['billing', 'error']),
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
	const { pageLocation: location } = Route.useRouteContext()
	return <AccountBillingPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

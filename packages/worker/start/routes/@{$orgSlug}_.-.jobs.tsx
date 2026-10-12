/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AccountJobsPage } from '../pages/account-jobs.tsx'
import { loadJobsPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadJobsPage', loadJobsPage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/jobs')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
	}),
	context: ({ location }) => ({
		pageQueryInput:
			location.pathname + pageSearch(location.searchStr, ['selected']),
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
	return <AccountJobsPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

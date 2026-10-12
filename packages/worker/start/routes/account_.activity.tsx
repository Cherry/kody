/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AccountActivityPage } from '../pages/account-activity.tsx'
import { loadActivityPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadActivityPage', loadActivityPage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/account_/activity')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
		view: search.view,
		status: search.status,
		surface: search.surface,
		error_triage: search.error_triage,
		triage: search.triage,
		cursor: search.cursor,
	}),
	context: ({ location }) => ({
		pageQueryInput:
			location.pathname +
			pageSearch(location.searchStr, [
				'selected',
				'view',
				'status',
				'surface',
				'error_triage',
				'triage',
				'cursor',
			]),
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
	return <AccountActivityPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

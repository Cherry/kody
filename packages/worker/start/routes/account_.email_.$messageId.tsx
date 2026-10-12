/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AccountEmailPage } from '../pages/account-email.tsx'
import { loadEmailPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadEmailPage', loadEmailPage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/account_/email_/$messageId')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		classification: search.classification,
		q: search.q,
		page: search.page,
		pageSize: search.pageSize,
	}),
	context: ({ location }) => ({
		pageQueryInput:
			location.pathname +
			pageSearch(location.searchStr, [
				'classification',
				'q',
				'page',
				'pageSize',
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
	const { payload, destinations } = usePageData()
	const location = useLocation()
	return (
		<AccountEmailPage
			payload={payload}
			destinations={destinations}
			currentHref={location.href}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

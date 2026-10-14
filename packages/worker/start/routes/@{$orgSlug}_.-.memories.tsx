/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { memoriesInput } from '../memories-input.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountMemoriesPage } from '../pages/account-memories.tsx'
import { loadMemoriesPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadMemoriesPage', loadMemoriesPage, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/memories')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
		q: search.q,
		includeDeleted: search.includeDeleted,
	}),
	context: ({ location, params }) => ({
		pageQueryInput: memoriesInput(
			params.orgSlug,
			location.searchStr,
			undefined,
		),
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: CollectionPage,
})
function CollectionPage() {
	const { payload } = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return <AccountMemoriesPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { CommunityRoute } from '../pages/community.tsx'
import { documentHead } from '../components/document-head.ts'
import { loadCommunity } from '#start/server/public-data'

const pageQuery = createPageQuery('loadCommunity', loadCommunity)

export const Route = createFileRoute('/community')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }) => search,
	context: ({ location }) => ({
		pageQueryInput: {
			search: location.searchStr,
		},
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Community,
})
function Community() {
	return <CommunityRoute data={usePageData().data} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

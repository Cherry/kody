/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountConnectionsPage } from '../pages/account-connections.tsx'
import { loadConnectionsPage } from '#start/server/account-collections'
import { connectionUsageQuery } from '../connection-usage-query.ts'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadConnectionsPage', loadConnectionsPage, {
	staleTime: 60_000,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/agents_/usage')({
	loaderDeps: ({ search }) => search,
	context: ({ location }) => ({
		pageQueryInput: location.pathname + location.searchStr,
	}),
	loader: async ({ context, preload }) => {
		const [page] = await Promise.all([
			loadPageQuery(
				context.queryClient,
				pageQuery(context.actorKey, context.pageQueryInput),
				preload,
			),
			context.queryClient.ensureQueryData({
				...connectionUsageQuery(context.actorKey, context.pageQueryInput),
				revalidateIfStale: true,
			}),
		])
		return page
	},
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { payload } = usePageData()
	const { pageQueryInput } = Route.useRouteContext()
	return (
		<AccountConnectionsPage payload={payload} currentHref={pageQueryInput} />
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AdminCommunityReportsPage } from '../pages/admin-community-reports.tsx'
import { loadAdminCommunityReports } from '#start/server/admin-community-reports'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery(
	'loadAdminCommunityReports',
	loadAdminCommunityReports,
	{ freshAuthorization: true },
)

export const Route = createFileRoute('/admin/community-reports')({
	loaderDeps: ({ search }) => search,
	context: ({ location }) => ({
		pageQueryInput: location.pathname + location.searchStr,
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: CommunityReportsPage,
})
function CommunityReportsPage() {
	const data = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return data.forbidden ? (
		<p>Forbidden</p>
	) : (
		<AdminCommunityReportsPage
			payload={data.payload}
			currentHref={location.href}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

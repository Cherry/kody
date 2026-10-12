/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AdminBannersPage } from '../pages/admin-banners.tsx'
import { loadAdminBanners } from '#start/server/admin-banners'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadAdminBanners', loadAdminBanners, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/admin/banners')({
	context: () => ({ pageQueryInput: undefined }),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: BannersPage,
})
function BannersPage() {
	const data = usePageData()
	const location = useLocation()
	return data.forbidden ? (
		<p>Forbidden</p>
	) : (
		<AdminBannersPage payload={data.payload} currentHref={location.href} />
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

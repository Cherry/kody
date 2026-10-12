/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AdminPlatformFeedbackPage } from '../pages/admin-platform-feedback.tsx'
import { loadAdminPlatformFeedback } from '#start/server/admin-platform-feedback'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery(
	'loadAdminPlatformFeedback',
	loadAdminPlatformFeedback,
	{ freshAuthorization: true },
)

export const Route = createFileRoute('/admin/platform-feedback')({
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
	component: PlatformFeedbackPage,
})
function PlatformFeedbackPage() {
	const data = usePageData()
	const location = useLocation()
	return data.forbidden ? (
		<p>Forbidden</p>
	) : (
		<AdminPlatformFeedbackPage
			payload={data.payload}
			currentHref={location.href}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

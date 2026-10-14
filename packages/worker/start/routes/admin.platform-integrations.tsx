/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AdminPlatformIntegrationsPage } from '../pages/admin-platform-integrations.tsx'
import { loadAdminPlatformIntegrations } from '#start/server/admin-platform-integrations'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery(
	'loadAdminPlatformIntegrations',
	loadAdminPlatformIntegrations,
	{ freshAuthorization: true },
)

export const Route = createFileRoute('/admin/platform-integrations')({
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
	component: PlatformIntegrationsPage,
})
function PlatformIntegrationsPage() {
	const mutationContext = Route.useRouteContext()
	const mutationQueryKey = pageQuery(
		mutationContext.actorKey,
		mutationContext.pageQueryInput,
	).queryKey
	const data = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return data.forbidden ? (
		<p>Forbidden</p>
	) : (
		<AdminPlatformIntegrationsPage
			queryKey={mutationQueryKey}
			payload={data.payload}
			currentHref={location.href}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

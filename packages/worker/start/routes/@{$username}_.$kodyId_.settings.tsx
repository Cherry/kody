/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadPackage } from '#start/server/public-data'
import { PackageSettingsRoute } from '../pages/package-settings.tsx'
import { renderMissingListing } from '../components/community-detail-sections.tsx'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadPackage', loadPackage, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/@{$username}_/$kodyId_/settings')({
	loaderDeps: ({ search }) => search,
	context: ({ location, params }) => ({
		pageQueryInput: {
			...params,
			page: 'settings' as const,
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
	component: Page,
})
function Page() {
	const data = usePageData()
	if (data.kind !== 'page')
		return renderMissingListing(
			'Unauthorized',
			'You are not allowed to view this page.',
		)
	return (
		<PackageSettingsRoute
			key={`${data.data.username}/${data.data.kodyId}`}
			data={data.data}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

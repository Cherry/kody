/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadPackage } from '#start/server/public-data'
import { PackageSettingsRoute } from '../pages/package-settings.tsx'
import { renderMissingListing } from '../components/community-detail-sections.tsx'
import { packageWebhooksQuery } from '../package-webhooks-query.ts'
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
	loader: async ({ context, preload }) => {
		const [page] = await Promise.all([
			loadPageQuery(
				context.queryClient,
				pageQuery(context.actorKey, context.pageQueryInput),
				preload,
			),
			context.queryClient.prefetchQuery(
				packageWebhooksQuery(context.actorKey, {
					username: context.pageQueryInput.username,
					kodyId: context.pageQueryInput.kodyId,
				}),
			),
		])
		return page
	},
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

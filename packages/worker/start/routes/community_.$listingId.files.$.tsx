/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadPackageFiles } from '#start/server/package-files'
import { PackageFilesExplorer } from '../components/package-files-explorer.tsx'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadPackageFiles', loadPackageFiles, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/community_/$listingId/files/$')({
	context: ({ location }) => ({
		pageQueryInput: {
			pathname:
				location.pathname +
				location.searchStr +
				(location.hash ? `#${location.hash}` : ''),
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
	return <PackageFilesExplorer data={usePageData().data} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

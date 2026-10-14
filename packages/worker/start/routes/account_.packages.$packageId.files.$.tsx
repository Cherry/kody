import { PackageNoAccessPage } from '../components/package-no-access-page.tsx'
/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadPackageFiles } from '#start/server/package-files'
import { PackageFilesExplorer } from '../components/package-files-explorer.tsx'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadPackageFiles', loadPackageFiles, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/account_/packages/$packageId/files/$')({
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
	const result = usePageData()
	if (result.kind === 'no_access') return <PackageNoAccessPage {...result} />
	return <PackageFilesExplorer data={result.data} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

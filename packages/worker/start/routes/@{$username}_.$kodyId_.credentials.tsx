/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { createPageQuery, loadPageQuery, usePageQuery } from '../page-query.ts'
import { PackageCredentialsRoute } from '../pages/package-credentials.tsx'
import { loadPackageCredentialsPage } from '#start/server/credentials'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery(
	'loadPackageCredentialsPage',
	loadPackageCredentialsPage,
	{ freshAuthorization: true },
)
export const Route = createFileRoute('/@{$username}_/$kodyId_/credentials')({
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
	component: Page,
})
function Page() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	const { payload } = usePageQuery(pageQuery(actorKey, pageQueryInput)).data
	return (
		<PackageCredentialsRoute
			key={pageQueryInput}
			payload={payload}
			currentHref={pageQueryInput}
		/>
	)
}

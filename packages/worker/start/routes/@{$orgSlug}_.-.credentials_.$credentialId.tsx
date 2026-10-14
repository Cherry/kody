/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { createPageQuery, loadPageQuery, usePageQuery } from '../page-query.ts'
import { AccountCredentialsRoute } from '../pages/account-credentials.tsx'
import { loadCredentialsPage } from '#start/server/credentials'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadCredentialsPage', loadCredentialsPage, {
	freshAuthorization: true,
})
export const Route = createFileRoute(
	'/@{$orgSlug}_/-/credentials_/$credentialId',
)({
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
		<AccountCredentialsRoute
			key={pageQueryInput}
			payload={payload}
			currentHref={pageQueryInput}
		/>
	)
}

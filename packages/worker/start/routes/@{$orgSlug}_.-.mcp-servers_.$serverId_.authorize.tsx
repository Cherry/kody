/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { createPageQuery, loadPageQuery, usePageQuery } from '../page-query.ts'
import { loadMcpServerAuthorizePage } from '#start/server/mcp-server-authorize'
import { documentHead } from '../components/document-head.ts'
import { AccountMcpServerAuthorizePage } from '../pages/account-mcp-server-authorize.tsx'
const pageQuery = createPageQuery(
	'loadMcpServerAuthorizePage',
	loadMcpServerAuthorizePage,
	{ staleTime: 0, gcTime: 0, freshAuthorization: true },
)
export const Route = createFileRoute(
	'/@{$orgSlug}_/-/mcp-servers_/$serverId_/authorize',
)({
	context: ({ location }) => ({ pageQueryInput: location.pathname }),
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
	const { data } = usePageQuery(pageQuery(actorKey, pageQueryInput))
	const location = useLocation()
	return data.payload ? (
		<AccountMcpServerAuthorizePage
			payload={data.payload}
			currentHref={location.href}
		/>
	) : (
		<main>
			<h1>{data.error}</h1>
		</main>
	)
}

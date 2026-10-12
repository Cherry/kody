/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadDocsConnect } from '#start/server/docs'
import { DocsConnectRoute } from '../pages/docs-connect.tsx'
import { documentHead } from '../components/document-head.ts'

const pageQuery = createPageQuery('loadDocsConnect', loadDocsConnect, {
	staleTime: 5 * 60_000,
	gcTime: 30 * 60_000,
})

export const Route = createFileRoute('/docs/connect')({
	context: () => ({ pageQueryInput: undefined }),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: DocsConnect,
})
function DocsConnect() {
	return <DocsConnectRoute {...usePageData()} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

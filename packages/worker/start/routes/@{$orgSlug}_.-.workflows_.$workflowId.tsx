/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountWorkflowsPage } from '../pages/account-workflows.tsx'
import { loadWorkflowsPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadWorkflowsPage', loadWorkflowsPage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/workflows_/$workflowId')({
	staticData: { orgScope: { section: 'workflows' } },
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
	}),
	context: ({ params, location }) => ({
		pageQueryInput: {
			orgSlug: params.orgSlug,
			workflowId: params.workflowId,
			selected:
				new URLSearchParams(location.searchStr).get('selected') ?? undefined,
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
	const { payload } = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return <AccountWorkflowsPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

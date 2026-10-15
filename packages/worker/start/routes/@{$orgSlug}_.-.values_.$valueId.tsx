/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountValuesPage } from '../pages/account-values.tsx'
import { loadValuesPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadValuesPage', loadValuesPage, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/@{$orgSlug}_/-/values_/$valueId')({
	staticData: {
		workspaceSwitch: { section: 'values', suffix: [{ param: 'valueId' }] },
		navigation: { rail: 'workspace', item: 'values' },
		orgScope: { section: 'values' },
	},
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
	}),
	context: ({ location, params }) => ({
		pageQueryInput: {
			orgSlug: params.orgSlug,
			valueId: params.valueId,
			create: false,
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
	component: CollectionPage,
})
function CollectionPage() {
	const { payload } = usePageData()
	const { pageLocation: location, pageQueryInput } = Route.useRouteContext()
	const selectedId =
		pageQueryInput.valueId?.trim() || pageQueryInput.selected?.trim() || null
	return (
		<AccountValuesPage
			payload={payload}
			currentHref={location.href}
			selection={
				selectedId ? { kind: 'detail', valueId: selectedId } : { kind: 'list' }
			}
		/>
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

/** @jsxImportSource @emotion/react */
import { loadActivityQuery } from '../activity-query.ts'
import { pageSearch } from '../page-search.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountActivityPage } from '../pages/account-activity.tsx'
import { documentHead } from '../components/document-head.ts'

export const Route = createFileRoute('/@{$orgSlug}_/-/activity')({
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		selected: search.selected,
		view: search.view,
		status: search.status,
		surface: search.surface,
		error_triage: search.error_triage,
		triage: search.triage,
		cursor: search.cursor,
	}),
	context: ({ location }) => ({
		pageQueryInput:
			location.pathname +
			pageSearch(location.searchStr, [
				'selected',
				'view',
				'status',
				'surface',
				'error_triage',
				'triage',
				'cursor',
			]),
	}),
	loader: ({ context, preload }) =>
		loadActivityQuery(
			context.queryClient,
			context.actorKey,
			context.pageQueryInput,
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	const { pageLocation: location } = Route.useRouteContext()
	return (
		<AccountActivityPage
			actorKey={actorKey}
			pageQueryInput={pageQueryInput}
			currentHref={location.href}
		/>
	)
}

/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { createPageQuery, loadPageQuery, usePageQuery } from '../page-query.ts'
import { loadOrgRepositories } from '#start/server/org-management'
import {
	AccountManagementShell,
	AccountPageHeader,
} from '../pages/account-management-components.tsx'
import { repositoryPageSearch } from '../page-search.ts'
import { ProfileRoute } from '../pages/profile.tsx'
const pageQuery = createPageQuery('loadOrgRepositories', loadOrgRepositories, {
	freshAuthorization: true,
})
export const Route = createFileRoute('/@{$orgSlug}_/-/repositories')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }) => ({
		limit: search.limit,
		q: search.limit != null ? search.q : undefined,
	}),
	context: ({ params, location }) => ({
		pageQueryInput: {
			slug: params.orgSlug,
			search: repositoryPageSearch(location.searchStr),
		},
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: () => ({ meta: [{ title: 'Repositories' }] }),
	component: Page,
})
function Page() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	const { data } = usePageQuery(pageQuery(actorKey, pageQueryInput))
	const href = useLocation({ select: (location) => location.href })
	return (
		<AccountManagementShell>
			<AccountPageHeader
				title="Repositories"
				description="Every repository in this workspace, private ones included. Your public profile shows visitors the public ones."
				currentHref={href}
			/>
			<ProfileRoute
				data={data}
				currentHref={href}
				basePath={new URL(href, 'https://kody.local').pathname}
			/>
		</AccountManagementShell>
	)
}

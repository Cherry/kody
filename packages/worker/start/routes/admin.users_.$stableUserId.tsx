/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AdminUsersPage } from '../pages/admin-users.tsx'
import { loadAdminUsers } from '#start/server/admin-users'
import { adminUsersFilters, adminUsersSelection } from '../admin-users-input.ts'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadAdminUsers', loadAdminUsers, {
	freshAuthorization: true,
})

export const Route = createFileRoute('/admin/users_/$stableUserId')({
	loaderDeps: ({ search }) => search,
	context: ({ location, params }) => ({
		pageQueryInput: {
			...adminUsersFilters(location.searchStr),
			selectedStableUserId: adminUsersSelection(
				location.searchStr,
				params.stableUserId,
			),
			detail: true,
			returnTo: location.pathname + location.searchStr,
		},
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: UsersPage,
})
function UsersPage() {
	const data = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return data.forbidden ? (
		<p>Forbidden</p>
	) : (
		<AdminUsersPage payload={data.payload} currentHref={location.href} />
	)
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadOrganizations } from '#start/server/org-organizations'
import { createPageQuery, loadPageQuery, usePageQuery } from '../page-query.ts'
import { OrganizationsPage } from '../pages/org-organizations.tsx'
const pageQuery = createPageQuery('loadOrganizations', loadOrganizations, {
	freshAuthorization: true,
})
export const Route = createFileRoute('/account_/organizations')({
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, undefined),
			preload,
		),
	head: () => ({ meta: [{ title: 'Organizations' }] }),
	component: Page,
})
function Page() {
	const { actorKey } = Route.useRouteContext()
	const { data } = usePageQuery(pageQuery(actorKey, undefined))
	return <OrganizationsPage data={data} />
}

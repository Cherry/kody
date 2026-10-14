import { createFileRoute } from '@tanstack/react-router'
import { loadOrgInvite } from '#start/server/org-management'
import { OrgInviteJoinPage } from '../pages/org-invite-join.tsx'
export const Route = createFileRoute('/join/$token')({
	preload: false,
	staleTime: 0,
	loader: ({ params }) => loadOrgInvite({ data: { token: params.token } }),
	head: () => ({ meta: [{ title: 'Join organization' }] }),
	component: Page,
})
function Page() {
	const data = Route.useLoaderData()
	const { actorKey } = Route.useRouteContext()
	const { token } = Route.useParams()
	return <OrgInviteJoinPage key={`${actorKey}:${token}`} data={data} />
}

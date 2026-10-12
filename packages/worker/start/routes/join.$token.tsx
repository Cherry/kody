/** @jsxImportSource @emotion/react */
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { loadOrgInvite } from '#start/server/org-management'
import { OrgAction, OrgShell } from '../pages/org-management.tsx'
import { SiteLink } from '../components/site-link.tsx'
import { routes } from '#universal/routes.ts'
export const Route = createFileRoute('/join/$token')({
	preload: false,
	staleTime: 0,
	loader: ({ params }) => loadOrgInvite({ data: { token: params.token } }),
	head: () => ({ meta: [{ title: 'Join organization' }] }),
	component: Page,
})
function Page() {
	const data = Route.useLoaderData()
	const router = useRouter()
	const { actorKey } = Route.useRouteContext()
	if (!data.ok)
		return (
			<section>
				<h1>Invite link</h1>
				<p role="alert">{data.error}</p>
			</section>
		)
	return (
		<OrgShell
			title={`Join ${data.org.displayName || data.org.slug}`}
			slug={data.org.slug}
		>
			<p>Role: {data.roleLabel}</p>
			{data.alreadyMember ? (
				<SiteLink href={`/@${data.org.slug}`}>Open organization</SiteLink>
			) : !data.authenticated ? (
				<>
					<SiteLink
						href={`/login?redirectTo=${encodeURIComponent(`/join/${data.token}`)}`}
					>
						Sign in to join
					</SiteLink>
					<SiteLink
						href={`/signup?redirectTo=${encodeURIComponent(`/join/${data.token}`)}`}
					>
						Create an account
					</SiteLink>
				</>
			) : (
				<OrgAction
					href={routes.orgInviteJoinPost.href({ token: data.token })}
					queryKey={['page', actorKey, 'orgInvite', { slug: data.org.slug }]}
					label="Join organization"
					onDone={(href) => void router.navigate({ href })}
				/>
			)}
		</OrgShell>
	)
}

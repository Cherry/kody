/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadOrgOverview } from '#start/server/org-management'
import { OrgShell } from '../pages/org-management.tsx'
import { AccountManagementPanel } from '../pages/account-management-components.tsx'
import { workspaceRailGroups } from '#client/routes/account-rail.ts'
import { SiteLink } from '../components/site-link.tsx'
export const Route = createFileRoute('/@{$orgSlug}_/-/overview')({
	loader: ({ params }) => loadOrgOverview({ data: { slug: params.orgSlug } }),
	component: Page,
	head: () => ({ meta: [{ title: 'Overview' }] }),
})
function Page() {
	const { slug } = Route.useLoaderData()
	return (
		<OrgShell title="Overview" slug={slug}>
			{workspaceRailGroups({ orgSlug: slug, personal: true, role: 'owner' })
				.filter((group) => group.label !== null)
				.map((group) => (
					<AccountManagementPanel key={group.label} title={group.label ?? ''}>
						<ul>
							{group.items.map((item) => (
								<li key={item.href}>
									<SiteLink href={item.href}>{item.label}</SiteLink>
									<p>{item.description}</p>
								</li>
							))}
						</ul>
					</AccountManagementPanel>
				))}
		</OrgShell>
	)
}

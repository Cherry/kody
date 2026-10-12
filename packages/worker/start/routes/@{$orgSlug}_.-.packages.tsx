/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from "@tanstack/react-router";
import { createPageQuery, loadPageQuery, usePageQuery } from "../page-query.ts";
import { loadOrgRepositories } from "#start/server/org-management";
import {
  AccountManagementShell,
  AccountPageHeader,
} from "../pages/account-management-components.tsx";
import { ProfileRoute } from "../pages/profile.tsx";
const pageQuery = createPageQuery("loadOrgRepositories", loadOrgRepositories, {
  freshAuthorization: true,
});
export const Route = createFileRoute("/@{$orgSlug}_/-/packages")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    limit:
      typeof search.limit === "string" || typeof search.limit === "number"
        ? String(search.limit)
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  context: ({ params, location }) => ({
    pageQueryInput: { slug: params.orgSlug, search: location.searchStr },
  }),
  loader: ({ context, preload }) =>
    loadPageQuery(
      context.queryClient,
      pageQuery(context.actorKey, context.pageQueryInput),
      preload,
    ),
  head: () => ({ meta: [{ title: "Repositories" }] }),
  component: Page,
});
function Page() {
  const { actorKey, pageQueryInput } = Route.useRouteContext();
  const { data } = usePageQuery(pageQuery(actorKey, pageQueryInput));
  const href = useLocation({ select: (location) => location.href });
  return (
    <AccountManagementShell>
      <AccountPageHeader
        title="Repositories"
        description="Every repository in this workspace, private ones included. Your public profile shows visitors the public ones."
        currentHref={href}
      />
      <ProfileRoute data={data} currentHref={href} />
    </AccountManagementShell>
  );
}

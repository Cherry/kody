/** @jsxImportSource @emotion/react */
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useRouteContext } from "@tanstack/react-router";
import { createOrg } from "#start/server/org-organizations";
import { invalidateShellQueries } from "../shell-query.ts";
import { SiteLink } from "../components/site-link.tsx";
import { type AccountOrganizationsLoaderData } from "#universal/loader-data.ts";
import {
  orgIdentity,
  orgRoleLabel,
  orgOverviewPath,
  orderOrganizations,
} from "#universal/org-pages.ts";
import {
  handlePermanentNote,
  handleUrlPreview,
} from "@kody-internal/shared/handle-permanence.ts";
import {
  AccountManagementShell,
  AccountManagementPanel,
  AccountPageHeader,
  accountInputCss,
} from "./account-management-components.tsx";
import { getPillButtonCss } from "#universal/styles/style-primitives.ts";
export function OrganizationsPage({
  data,
}: {
  data: AccountOrganizationsLoaderData;
}) {
  return (
    <AccountManagementShell>
      <AccountPageHeader
        title="Organizations"
        description="Each organization has its own repositories, secrets, and members."
        currentHref="/account/organizations"
        actions={
          <SiteLink href="/account/organizations/new">
            Create organization
          </SiteLink>
        }
      />
      <AccountManagementPanel title="Your organizations">
        <ul data-testid="account-organizations">
          {orderOrganizations(data.organizations).map((org) => {
            const identity = orgIdentity(org, data.viewer);
            return (
              <li key={org.slug} data-testid="account-organization">
                <SiteLink
                  href={
                    org.personal ? orgOverviewPath(org.slug) : `/@${org.slug}`
                  }
                >
                  {identity.avatarUrl ? (
                    <img
                      src={identity.avatarUrl}
                      alt=""
                      width={44}
                      height={44}
                    />
                  ) : null}
                  {identity.name} · {identity.handle}
                </SiteLink>
                <p>
                  {orgRoleLabel(org.role)}
                  {data.lastUsedOrganization === org.slug ? " · Current" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      </AccountManagementPanel>
      <section id="invites">
        <AccountManagementPanel title="Invitations">
          {data.invites.length ? (
            <ul data-testid="invites-list">
              {data.invites.map((invite) => (
                <li key={invite.id} data-testid="invite">
                  {invite.orgDisplayName || `@${invite.orgSlug}`} ·{" "}
                  {invite.role || invite.kind} · Expires {invite.expiresAt}
                </li>
              ))}
            </ul>
          ) : (
            <p data-testid="invites-empty">No invites waiting.</p>
          )}
        </AccountManagementPanel>
      </section>
    </AccountManagementShell>
  );
}
export function CreateOrganizationPage() {
  const client = useQueryClient(),
    router = useRouter(),
    { actorKey } = useRouteContext({ from: "__root__" });
  const draft = new URL(router.state.location.href, "https://kody.local")
    .searchParams;
  const [displayName, setDisplayName] = useState(
    draft.get("displayName") ?? "",
  );
  const [slug, setSlug] = useState(draft.get("slug") ?? "");
  const [slugEdited, setSlugEdited] = useState(draft.has("slug"));
  const [confirming, setConfirming] = useState(false);
  const createOrganization = useServerFn(createOrg);
  const mutation = useMutation({
    mutationFn: (data: { displayName: string; slug: string }) =>
      createOrganization({ data }),
    onSuccess: async (result) => {
      await Promise.all([
        invalidateShellQueries(client, actorKey),
        client.invalidateQueries({
          queryKey: ["page", actorKey, "loadOrganizations"],
        }),
      ]);
      await router.navigate({ href: `/@${result.slug}` });
    },
  });
  return (
    <AccountManagementShell>
      <AccountPageHeader
        title="Create organization"
        description="Choose a permanent handle and a name for your team."
        currentHref="/account/organizations/new"
      />
      <AccountManagementPanel title="Organization details">
        <form
          data-testid="create-organization-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirming) {
              setConfirming(true);
              return;
            }
            mutation.mutate({ displayName, slug });
          }}
          css={{ display: "grid", gap: "1rem" }}
        >
          <label>
            Name
            <input
              css={accountInputCss}
              name="displayName"
              required
              maxLength={80}
              autoComplete="organization"
              value={displayName}
              onChange={(event) => {
                const name = event.currentTarget.value;
                setDisplayName(name);
                if (!slugEdited) {
                  setSlug(slugFromName(name));
                  setConfirming(false);
                }
              }}
            />
          </label>
          <label>
            Handle
            <input
              css={accountInputCss}
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.currentTarget.value.toLowerCase());
                setConfirming(false);
              }}
              minLength={3}
              maxLength={32}
              pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <p>{handleUrlPreview(slug)}</p>
          <p>{handlePermanentNote}</p>
          {confirming ? (
            <p role="status" data-testid="create-organization-confirmation">
              Create {handleUrlPreview(slug)}? This handle is permanent.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={mutation.isPending}
            css={getPillButtonCss()}
          >
            {mutation.isPending
              ? "Creating…"
              : confirming
                ? "Yes, create organization"
                : "Create organization"}
          </button>
          <SiteLink href="/account/organizations">Cancel</SiteLink>
          {mutation.error ? <p role="alert">{mutation.error.message}</p> : null}
        </form>
      </AccountManagementPanel>
    </AccountManagementShell>
  );
}

function slugFromName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

# Start parity audit, October 13, 2026

Baseline: `d52300fa4a8602e2a06b7cdd583168641e486b5d`. This audit compares
behavior and source against that fixed main commit, not moving main.

## Confirmed gaps repaired

- Public footer: Features, Use cases, and For / Business navigation.
- Admin system email: confirmation, deletion, pending/error feedback, and
  authoritative list refresh. A real local browser test covers deletion, reload
  persistence, and a concurrent deletion returning 404.
- Usage: ranked package credit attribution, Show all, ad hoc usage, meters, and
  cumulative charts. Package settings also show package attribution.
- Organization invitations: Copy link action and clipboard error feedback.
- Admin user detail: organization limit overrides and email destination
  verification controls, with actor/org-scoped Query ownership.
- Package settings: publish, delete, and community adoption controls now honor
  the separate permission flags already supplied by the backend. Backend
  authorization was retained; the omitted UI gates were misleading.
- Onboarding: server-selected agent order survives hydration, while later client
  navigation retains the session choice.
- Docs: the baseline eagerly warmed permitted sidebar destinations. The original
  Start port used only intent preloading. This is a performance parity gap, not
  an equivalent implementation. Native Router render preloading restores that
  behavior. A browser regression verifies the next article loads before any
  intent event and navigation/revisit work with subsequent server function
  requests blocked. Removing the fix makes the preload assertion fail. This is
  local evidence, not a production latency benchmark. The old intent-only tests
  encoded a different request-volume policy and are updated to test the restored
  user experience.

The Features header menu was repaired in the preceding commit.

## Method and limits

Compared baseline public and private route inventories, destinations, controls,
mutation actions, and permission gates with the Start pages. Followed missing
components into their replacements instead of assuming that merged history or
existing tests demonstrated parity. Public landing, feature, docs, blog,
community, profile, auth, onboarding, organization, account, and admin source
were included. Focused render and Query tests cover the repaired controls.
Source review does not prove all interactive paths or all permission states.
Preview verification must identify the deployed commit. Admin mutations use
local disposable fixtures because the preview seed user is not an admin.

## Backend scope

This is not a complete removal of Remix. Start renders the app and handles
server functions. The retained HTTP/API router uses `remix/router`; D1 access
uses `remix/data-table`; validation uses `remix/data-schema`. Cookies, route
helpers, cross-origin protection, and some HTML utilities also remain. There is
one runtime router creation and 104 type-only router imports in the non-test
worker/shared source inventory. Import counts are not bundle sizes. Core
billing, MCP, jobs, package runtime, database, shared code, and the runtime,
platform, and jobs workers retain their baseline implementation. These are
separate from the migrated browser router and client state ownership.

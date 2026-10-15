# Start parity audit

## Follow-up at source `b1ae9038c`

The previous E2E run finished with 167 passes and three failures. Two retained
admin-form cases exposed a stale reserved-name snapshot across request env
objects; admin reads now bypass the public username-validation memo, with a
cross-env regression case. The webhook fixture attempted Git against the local
mock Artifacts service; it now publishes through that service's snapshot API.
The production package source safety policy remains unchanged.

This source also replaces the global organization pathname guard with native
route authorization and explicit OAuth/download scope checks. Invalid OAuth
organization input cannot become personal scope. Unsupported methods may return
native 405 before authorization instead of the old early 404. Entity explanation
copy is selected explicitly by page owners rather than by a pathname matcher.

All four Start typechecks, worker-test and tools typechecks, lint, Knip, and
documentation reference checks passed. Runtime confirmation is pending in
Validate run `38717968492`; preview run `38717968495` is also pending. These
changes do not establish authenticated or populated-fixture visual parity.

## Preview check at source `fb9728a37`

Preview run `38715337497` succeeded. The health endpoint reports deployed merge
`ce82d2e25b583900941f5dd9c2cf58c5f8e2249b`, combining that source with main
`dac9ea01b12fb4824d437792b6c578c23ced797e`.

The anonymous community page rendered its empty state in Chrome at 1728×941,
with the heading, search form, illustration, and connect links visible. No browser
console errors were captured. Production has populated package listings, so this
does not prove populated listing or package detail parity. Authenticated and
matched-fixture visual checks remain incomplete.

Validate run `38715337519` passed Workers and MCP. Static and Node failed;
the stale documentation reference, removed-copy assertion, and native test fixture
failures have subsequent local fixes. E2E was still running at this observation.

## Current evidence, October 15, 2026

### Validation at source `6832c4630`

Validate
[38711856454](https://github.com/kentcdodds/kody/actions/runs/38711856454)
finished with Static, Node, Workers and E2E failures. MCP passed. The six E2E
failures include OAuth authorization returning 500 and follow management failing
to arm its confirmation control. This run does not establish merge readiness.

Source inspection identified a request-boundary defect: the OAuth provider adds
helpers to the request environment, but the Start entry passed only document
metadata into its server context. OAuth handlers read global bindings and lost
those helpers. The correction must preserve request-local bindings for consent,
password and OAuth client operations without exposing bindings to browser state.
Runtime verification of that correction is outstanding.

Local commits `0652b78be` and `c1fdd7dee` remove duplicate collection selection
parsing, constant page-loading state, and the production token-preload registry.
Native routes provide selection and preload policy. The shared collection helper
only builds links. Route-component coverage includes legacy selected-search
links and path precedence. Commit `c3d68fee4` uses native navigation for Manage
follows and adds a same-document E2E assertion. These commits require CI runtime
verification. No local runtime tests were run.

Preview deployment `38711856447` succeeded for source `6832c4630`; the verified
health response identified deployed merge
`3ea35f9a615b9e6727b766de8a5433941c6944ff`. Public OAuth error and invalid
unsubscribe pages were visually compared, with different authentication and
viewport states limiting those comparisons. Full authenticated and matched
visual parity remain incomplete.

### Follow-up at source `0c9578c8f`

A subsequent source audit found a remaining cutover issue in billing/usage,
organization reads and billing completion errors. Installed Start 1.170.34 marks
thrown `Response` values as raw responses; its browser fetcher returns those
before checking HTTP status. A caller can therefore receive a Response instead
of the expected typed data or rejected error. Server authorization is still
enforced, but error rendering and completion redirects can regress. These throws
use native serializable errors and explicit status locally. All four Start
typechecks pass; added read and completion regression tests still require CI
runtime proof.

Pushed head `0c9578c8f5c3830826a4066c5b370e7fe2397d7a` includes main
`3c09d6737`. All four Start TypeScript configurations passed after merging.
Preview `38708657868` completed successfully. Its health endpoint reports
`ok: true` at deployed merge `5c4b473ec7385ab72eb0fe0c969b9bbb343be95a`,
containing this head and main `3c09d6737`. Validate `38708657887` has Static
failures for two unused follows validators and stale architecture-map paths, and
one Workers failure from the new scheduled lane missing its dispatch-test mock.
Those are corrected locally; Node and E2E remain running at this check. The
architecture map and unused-export checks pass locally.

The incoming follows feature uses native Start routes, Query resources and
separate follow, resume and unfollow server functions. Shared operations retain
workspace binding, target permissions, rate limits and ownership checks. The
legacy follows page, package controller and HTTP handler total 1,231 removed
lines compared with incoming main. No website follows JSON endpoints remain.
Retired org JSON/action paths no longer count as website routes. Modified
follow-link clicks retain normal browser navigation.

The preceding Validate `38705271509` finished with one E2E failure: the
revocation test expected the retired MCP index, which redirects to Credentials.
The corrected test warms the canonical Credentials page and retains real
membership removal, same-document cache revisit and forged-write denial. That
correction, the new follows coverage and the direct HEAD verification RPC
regression await the current CI run. No local runtime tests were run for this
catch-up. Migration files and the migration ledger match fetched main exactly.

Authenticated preview and matched visual verification remain incomplete.

### Follow-up at source `083f0e961`

Validate `38705271509` for pushed head `423e7534c` passed Static, Node, Workers
and MCP. Browser E2E later failed as described above. Preview `38705271507`
completed successfully. `/health` returned `ok: true` at deployed merge
`12d4f005d572da2bdaf78634f284d4ca760f6b1d`, containing `423e7534c` and main
`8494ca6b7`.

Local commits `428474138`, `895100ab9`, and `083f0e961` remove email and webhook
post-write page reconstruction and entitlement writes during website reads.
Query reconciliation preserves uncached navigation promises and performs
confirming reads after older responses settle. Entitlement recovery uses the
existing scheduled infrastructure and storage, with atomic deletion and
personal-org mapping checks. Start and worker-test static checks passed; these
local additions still need CI runtime coverage.

Source inspection of the installed Start server-functions handler confirms that
direct RPC HEAD requests to GET token functions receive 405 before handler
execution. Existing mocked token tests do not prove this HTTP behavior.
Authenticated preview and matched visual verification remain incomplete.

### Follow-up at source `9fabf327b`

Validate `38702598529` for pushed head `665fa04ff` passed Node (6082 tests in
1544 files), Workers and MCP. Browser E2E completed with one avatar fixture
failure: its invalid storage key hid the Remove avatar control. The fixture now
uses the real key format and checks persistence after removal. Static failed
only the formatting step; `d22265e57` applies the repository formatter to the
affected documentation.

Preview `38702598610` succeeded. `/health` returned HTTP 200 at deployed merge
`e3494fa971842a5cf9792e12f7ab462feb81c132`, containing `665fa04ff` and main
`fc93d6632`. Later local commits are not included in this deployment.

Local commits add permission-change invalidation for actor-scoped resource
caches, real package lock/visibility/delete browser coverage, and revoked-member
navigation/write coverage. These additions have static checks but await CI.
Billing completion is now separated from cached reads. MCP website reads now
observe status without restoring connections or performing writes; operational
calls maintain a sanitized projection in existing DO storage, with cold status
reported as unknown. No schema change is required. These additions await CI.
Authenticated and matched visual verification still keep cutover readiness
unproven.

### Follow-up at source `665fa04ff`

Validate `38700601053` completed for `6d7ea0401`: Workers, MCP and browser E2E
passed; Static and Node failed. The Node job passed 6055 tests and failed nine
tests, with additional suite-load failures. Corrections preserve scoped write
and persisted-state assertions while updating obsolete page-result expectations,
validator mocks, reset mock defaults, and detached reconciliation timing.

Head `665fa04ff` includes those corrections, the prior navigation settlement
fixes, and separate typed invite operations. Package invite creation and
revocation no longer rebuild lists after writes. Invite reads include actor
metadata and cancellation signals for identity-aware refresh. Static checks
passed for the changed code; runtime verification is pending in Validate
`38702598529`. Preview run `38702598610` is also pending. The last verified
deployment remains `fb02ca65fc255520eebb4c34976bf436b451fe14`.

Authenticated preview and matched visual comparisons remain incomplete. Passing
the earlier E2E job does not establish parity for these later changes.

Critical-action coverage review found these remaining gaps in browser test
source:

- Package settings: publish, visibility, lock and deletion need real UI writes,
  persistence checks and denied-user cases. Existing package access and
  collaborator tests do not cover those operations.
- Billing: `late-checkout.spec.ts` checks a navigation race with a mocked
  checkout response, not successful checkout, portal or return reconciliation.
- Organization permissions: missing role-change or member-removal UI journeys
  followed by warm-cache navigation and a rejected write as the revoked member.
- Invites: existing creation and acceptance journeys do not establish link
  revocation, expiration, duplicate acceptance or lost-response behavior.
- Passkeys and two-factor authentication have successful browser journeys, but
  cancellation and failure coverage is incomplete.

These are coverage gaps, not observed product failures. The full E2E directory
is included by Playwright, so coverage outside `e2e/start` also counts.

### Follow-up at source `7ac5a2af0`

Preview run `38700600974` deployed merge
`fb02ca65fc255520eebb4c34976bf436b451fe14`, containing PR head `6d7ea0401` and
main `fc93d6632`. The health endpoint returned HTTP 200. This revision includes
the native approval-page copy port, shared signed access tickets, and
feature-flagged credential-need enforcement. No migration files differ from
main.

Validate `38700601053` passed Workers and MCP at inspection. Node and E2E were
running. Static found a merged test calling a deleted handler and two unused
exports. Commit `7ac5a2af0` updates the test to the domain operation, removes
the unused website absorb operation, and narrows the copy export. Worker-test
TypeScript and Knip pass locally after those corrections.

Review also found settlement cancellation could reject uncached navigation
promises, and retained account navigation could leave resend pending or accept
an old avatar completion. Local fixes preserve uncached reads, derive network
pending state from Query, and guard callbacks with captured submission identity.
Regression coverage uses actual page-query barriers and held browser responses.
These local changes are not in the verified preview and need CI execution.

Terms-to-Privacy navigation and browser back completed without console errors on
the prior preview. This narrow public smoke check is not a matched-state visual
comparison. Authenticated parity remains unverified.

### Follow-up at source `6d83c25cc`

Validate run `38697218301` for pushed head `8924216b8` passed Node, Workers, and
MCP. E2E was still running at inspection. Static failed formatting in this
document and the Start architecture guide. Commit `3195588c9` formats both
files; CI has not verified that commit.

The verified preview deployment is `bdc2e9de4447380f060d965babf42295c074bf54`,
containing head `8924216b8` and main `d46dc2a3d`. Its health endpoint returned
HTTP 200. Later local commits are not included in that deployment.

Local changes through `6d83c25cc` remove post-write page rebuilds from team
invite links, organization settings, connected agents and profiles, social
connections, package operations, and MCP server settings. Package and MCP writes
use operation-specific mutations. MCP review caught a missing listing
invalidation after response cache replacement was removed. The correction
invalidates `loadMcpServersPage` for the submitted actor and organization, with
coverage for successful writes and lost responses. MCP usage pending state comes
from the mutation and its submitted server ID. These regression cases have
static type coverage but have not run in CI.

Action dispatchers in email destinations, secrets, and secret providers remain
under review. Direct import searches still find Remix routing only in the
customer package-app fixture, not the website implementation. This does not
prove that all inherited architecture is removed.

Public docs navigation and browser back worked on the preview without browser
console errors during the inspected journey. The desktop docs comparison used
anonymous preview and authenticated production, so it does not establish
matched-state parity. Authenticated visual verification remains incomplete.

### Follow-up at source `412ad9a0b`

Preview health returned HTTP 200 at deployed merge
`a3a326c411a7e7a2f91377a65bfe8bf7be1967ef`, containing PR head `87483f6df` and
main `d46dc2a3d`. This verifies deployment identity and health, not visual
parity. The subsequent local fixes have not been deployed.

Validate run `38695335762` passed Workers and MCP. Static failed two
documentation checks: temporal wording and a link to a deleted mutation helper.
Both checks pass locally after `78007b36a`. Node passed 6018 tests and failed
three: the same broken link and two deletion assertions expecting rebuilt lists.
The deletion tests in `412ad9a0b` assert operation results and independently
read persisted state. Browser E2E was still running at inspection. These fixes
need CI.

System-email deletion, custom domains, admin settings, credit settings, passkey
rename/delete, and OAuth client writes return operation outcomes independently
of subsequent reads. The generic page-response mutation helper is deleted. Query
lifecycle callbacks reconcile submitted resource scopes. Retained-page pending
controls derive from mutation state, with browser coverage added for search and
hash navigation during an accepted write. That new coverage has not run yet.
Start type checks and targeted lint passed for the pending-state and codemod
input changes; no local runtime tests were run.

A desktop pricing comparison used authenticated production and anonymous preview
sessions. The extra improved-search sentence is controlled by
`jevSearchRerankFlagKey` in the Start pricing route. This comparison does not
establish matched-state visual parity.

A source search across packages found no production imports of Remix routing
modules outside the customer package-app fixture. This is evidence about direct
imports, not proof that all inherited architectural patterns are gone.

A fresh browser visit to the private package fixture showed a signed-out
not-found page. Logged-in verification has not been repeated on this deployment;
the browser sign-in attempt was blocked by approval review and awaits explicit
authorization for the documented preview test account. This is not evidence that
the fixture was deleted or that authenticated package navigation failed.

Reviewed source: `ca68f1116bbf1ee6c05084789792e0ce2050e751`. Main included in
that revision: `104d59e3cefa6aca891409e7e8eab51677f2792c`.

The October 13 findings below are historical. In particular, their retained
Remix router description no longer describes the website. Start owns website
server functions and explicit HTTP routes; Router owns navigation; Query owns
page payloads and mutation reconciliation. A source search of worker Start,
client, worker server, and shared code found no website Remix router imports.
Remix router strings remain in the hosted package-app test fixture, which tests
customer applications rather than routing the Kody website. Leaf cookie, schema,
data-table, and HTML helpers remain intentional. See
[retained HTTP contracts](./tanstack-start-http-contracts.md).

Recent changes removed redundant route refreshes, URL-derived cache scope, and
admin writes that rebuilt discarded list payloads. Organization cache tests now
exercise structured organization and resource inputs. Admin regression cases
check that writes and one-time setup results do not depend on list reads.

| Evidence                                     | Scope and limit                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validate run `38689815628`, head `5632ec74c` | E2E, Workers and MCP passed. Static formatting and two SSR text assertions failed and were corrected afterward. This does not validate later commits.                                                                                  |
| Validate run `38691381293`, head `1d928058d` | Workers and MCP passed at inspection. Node and E2E were running. Static found a missing context type guard, fixed in `cf5a7fc0a`.                                                                                                      |
| Full Start TypeScript checks                 | Passed through `ca68f1116`. Static evidence only, no runtime test claim.                                                                                                                                                               |
| Preview health                               | HTTP 200 at deployed merge `33a6999565bcd68bd8994a1ec2f4a3378a8623b0`, containing `1d928058d`. Does not include subsequent local commits.                                                                                              |
| Desktop homepage comparison                  | Viewed live baseline and preview at 1280x900, dark theme. Heading dimensions and wrapping matched, vertical position differed by 1.64px. Baseline was authenticated and preview anonymous, so this is not a matched-state parity pass. |

Full cutover readiness is not established. Remaining visual evidence must pair
matching roles, fixtures, viewport, theme, and revisions. This includes public
page families, populated package detail and publishing states, invitation flows,
account and organization screens, and administration. Historical screenshots
without revision and fixture records do not establish current parity. Browser
behavior tests also do not prove pixel equivalence. Real-provider callbacks and
other external protocol journeys need their own scoped evidence.

## Historical audit, October 13, 2026

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

Start owns website routing, rendering, server functions, and the retained
website HTTP contracts. A source import audit at `423e7534c` found no
`remix/router`, `react-router`, or `@remix-run` imports in application code. The
remaining `remix/router` matches are source strings in the test fixture for
user-authored package apps, which are a separate runtime concern.

Remix remains for leaf utilities such as D1 tables, schemas, cookies, and HTML
responses. Shared billing, MCP, jobs, package execution, storage, and protocol
business logic still run behind their respective boundaries. Removing router
imports does not prove that all inherited architectural patterns or behavioral
regressions are gone. The read-side effects and mutation lifecycle audits above
remain part of that assessment.

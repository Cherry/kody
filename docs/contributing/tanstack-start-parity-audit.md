# Start parity audit

## Current cutover evidence

Validate run `38727730565` for source `672913f5f` has passed Static, Workers
and MCP. Node finished with 6,403 passes and two failures, both in the new
imperative auth hook test harness with an invalid hook call. Browser E2E also passed. Commit `be8ba14b5` repairs the hook harness using
real React rendering and native Router context. The repair and later local
commits have not yet been verified by CI.

Preview run `38727730278` succeeded. Its health endpoint reports merge
`15aff77590127fbde7ebd91cd92ef93b4688552d`, containing source `672913f5f`.
The homepage returned complete HTML. Login rendered and hydrated, and its
Forgot password link reached the rendered reset-password page. No credentials
were entered during this check.

## Incoming self-publish feature

Main `95904f850` was merged locally without conflicts. The automatic publishing
and credential restriction implementations match main. Start package mutations
still delegate to the shared owner approval operations, as main's website does.
Automatic publishing is initiated by agent package updates or successful
security-audit recording, not by the website visibility button. Website input
cannot supply the domain's self-publish request marker.

The imported tests cover stale commits, permission denial, request races,
credential restrictions and owner reapproval. This is source parity evidence;
the merged revision still needs CI and deployed verification.

## Earlier visual comparisons

Preview merge `7a1dcb3dbe7e21216249949b3bc9f28b66b4ee8b` serves the `5b1e2760d`
source. Its homepage returned complete HTML, matching CSP and markup nonces, and
rendered visibly in Chrome. A pricing comparison at 1280 by 800 showed aligned
main layout and typography, but production was authenticated and preview was
anonymous. Feature-flag copy and account-dependent controls differ, so this is
bounded visual evidence, not matched-state parity.

At the same preview revision, the settled `/docs` first viewport was visually
compared with production at 390 by 844. Header, docs disclosure, title, article
wrapping and background aligned; preview had no horizontal overflow. The mobile
main menu opened, its Pricing link reached `/pricing`, and the menu closed on
arrival. This checks one public viewport and one navigation, not all mobile
screens or authenticated state parity.

The local authentication correction uses native Start redirect handling for
imperative calls and stops follow-up work when navigation consumes the result.
Query mutations retain native Query/Router error handling so redirects cannot be
mistaken for successful writes. Added tests cover both boundaries and an expired
passkey session before authenticator invocation. They require CI.

Remaining gaps in browser and visual evidence:

- OAuth: `9b624a151` adds a valid callback through the existing mock provider,
  actual server token exchange, persisted credential listing and reloaded
  detail. Runtime confirmation and subsequent credential use remain unproven.
  The current shared operation returns no separate host approval links; this
  journey checks saved required hosts rather than inventing an approval step.
  Real external-provider behavior remains unverified.
- Billing: `e2e/start/late-checkout.spec.ts` mocks checkout to test stale
  navigation. `credit-top-up-return.spec.ts` covers anonymous redirects, HEAD
  safety and invalid sessions. Commit `07d603505` adds a local Stripe simulator
  and a browser journey through subscription checkout, portal return, credit
  purchase, reload and duplicate-return protection. It uses real Start operations
  and checks the persisted balance and ledger count. Runtime confirmation is
  pending; a simulated provider does not establish live Stripe parity.
- Visuals: recorded comparisons use different authentication states or viewport
  sizes, and preview community listings are empty while production is populated.
  There are no screenshot assertions under `e2e`. Populated package detail and
  publishing, authenticated account/org/admin screens and mobile states still
  need matching roles, fixtures, viewport, theme and deployed revisions.
- Invites: `7acc1e432` adds revoked and expired stale-offer rejection,
  lost-response reconciliation and duplicate acceptance from a second tab,
  including owner-visible use count and denied team access. These additions
  require CI; they do not exercise an explicit Retry button.
- Authentication recovery: `e2e/passkeys.spec.ts` and `e2e/two-factor.spec.ts`
  cover successful lifecycles. Cancelled WebAuthn, failed authenticator
  assertions, rejected TOTP and retry feedback are not covered by those
  journeys.

Package settings and organization revocation now have the browser coverage
listed in the updated historical review below. Session identity, admin
revocation, cross-site RPC rejection, collaborators, webhooks and held profile
mutations also have dedicated browser tests. Test source establishes coverage
intent, not a passing result for the current revision. These gaps are not newly
observed product failures, and behavioral tests do not prove pixel parity.

## Native cache and credit-return follow-up

Anonymous cache eligibility and TTL now live on native routes. The origin no
longer maintains a separate URL table. Frame-specific cache handling and the
package document classifier are removed. Independent review checked session,
authorization, referral, cookie, deployment-version, completeness, and nonce
boundaries. Pending Start event cookies force no-store for every content type,
including plaintext responses that already carry public cache headers.

Added native middleware lifecycle coverage for cache hits skipping loaders, HEAD
bodies, pending cookies, private routes, and error responses, plus workerd nonce
rewrite coverage. These tests await CI execution. Full typecheck passed; the
final event-cookie adjustment also passed the server-test typecheck.

Both usage routes now share native middleware that rejects actionable payment
HEAD requests before loaders. Ordinary requests reach native authentication and
redirect loaders, correcting the two browser failures from run `38720130750`.
Runtime confirmation remains pending.

## Follow-up at source `d9c4311c6`

Preview run `38720130802` succeeded. The health endpoint confirmed deployed
merge `8dbec28f73254a1b4a66b1a66131f4a2214cbf09`. The unknown-route response now
returns HTTP 404 with the title `Not found`.

Validate run `38720130750` passed Workers and MCP. Node finished with 6,341
passing tests, six failed assertions, and one suite-loading failure. The
community-detail fixture replaced the entire Start module and omitted native
middleware. The OAuth navigation fixture ran Router in server mode, where client
navigation is ignored. Both have local corrections that preserve the existing
assertions. Retained-page and head-navigation failures are still under review.
The account-rail assertion and Static typecheck boundary have local corrections.
Browser E2E finished with 164 passes and two failures, both on the legacy
/account/usage credit-return URL: anonymous login redirection and safe HEAD
handling. The server reported that a componentless route cannot defer to the app
renderer. This is a route contract regression under correction.

The working tree also moves workspace-switch destinations and document
negotiation into native route metadata and middleware. Independent review found
that negotiated redirects need `Vary: Accept` as well as HTML bodies; the local
correction covers redirects and bodyless responses. Motion grouping now belongs
to native route metadata, with an independent review of shell, profile, package,
encoding, and unknown-path behavior. The duplicate URL classifier was removed.
Two-factor operations now enforce rate limits at the shared business boundary,
with regression coverage. Local full typecheck, formatting, lint, and Knip
passed before the latest test fixture corrections. No local runtime tests were
run. These changes still need CI and deployed confirmation.

Browser comparison on deployed merge `8dbec28f7` followed the docs index's Next
link to `/docs/search-and-execute`, then used browser Back to return to `/docs`
on both hosts. Destination headings and URLs matched. Viewed screenshots of
Search and execute showed matching article typography, wrapping, sidebar
selection, and background treatment. Production remained signed in and preview
anonymous, so header/admin navigation differences and viewport-height
differences prevent an exact matched-state visual parity claim.

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
Validate run `38717968492`. Workers, MCP, and E2E passed. Node finished with six
failures: four OAuth scope fixtures imported an incomplete Cloudflare mock, and
two MCP authorization cases treated an inaccessible organization as signed out.
Corrections are being reviewed locally without weakening the assertions. Static
failed only its Format step; local formatting corrections have not yet been
verified by a subsequent CI run. Preview run `38717968495` succeeded, and the
health endpoint confirms deployed merge
`27bb89acdc80ce0a36f754a5b5c03f048ce26f3d`, combining this source with main
`742ca59d3ccd3fe366668f6870c376cba91c012f`. These changes do not establish
authenticated or populated-fixture visual parity.

Live anonymous HTTP comparisons on that deployed merge matched production status
and title for `/faq`, `/pricing`, `/login`, and `/community`. Canonicals
retained each page path on the respective deployment origin. `/robots.txt` and
`/sitemap.xml` returned 200 with the expected text and XML content types. An
unknown route returned 404 on both hosts, but its preview title was `Kody`
instead of production's `Not found`. That is an open head-metadata regression,
not a passing parity check. These HTTP observations do not verify rendering,
navigation, sitemap contents, or authenticated behavior.

Browser comparison of `/faq` confirmed the first disclosure opens with matching
answer text and documentation link on both hosts. Screenshots showed matching
main content typography and wrapping. Measured main content height was
1242.6328125px on both; its vertical origin differed by 1.640625px, matching the
header height difference. Production was signed in and preview anonymous, with
1728px widths but different viewport heights (941px and 885px). This is limited
FAQ interaction evidence, not exact matched-state visual parity.

## Preview check at source `fb9728a37`

Preview run `38715337497` succeeded. The health endpoint reports deployed merge
`ce82d2e25b583900941f5dd9c2cf58c5f8e2249b`, combining that source with main
`dac9ea01b12fb4824d437792b6c578c23ced797e`.

The anonymous community page rendered its empty state in Chrome at 1728×941,
with the heading, search form, illustration, and connect links visible. No
browser console errors were captured. Production has populated package listings,
so this does not prove populated listing or package detail parity. Authenticated
and matched-fixture visual checks remain incomplete.

Validate run `38715337519` passed Workers and MCP. Static and Node failed; the
stale documentation reference, removed-copy assertion, and native test fixture
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

The coverage gaps recorded here were reviewed again at source `1b97b13d6`.
Package settings now have real UI lock, public-visibility and deletion writes,
reload persistence, confirmation and denied-account replay coverage in
`e2e/start/package-settings-mutations.spec.ts`. Removed organization membership
now has warm-cache revisit and a real rejected write covered by
`e2e/start/org-permission-revocation.spec.ts`. These additions close the earlier
blanket gaps for those cases, not every publishing or permission-change flow.
See the current cutover coverage review above for remaining gaps.

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

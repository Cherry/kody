# Website framework ownership audit

This inventory describes the migration source, including the current cleanup
slice. It is not a claim that CI, the deployed preview, every browser state, or
visual parity has passed. See the
[HTTP contracts inventory](./tanstack-start-http-contracts.md) for retained
external URLs and their consumers.

## What Start owns

Paths below are relative to `packages/worker/`.

| Responsibility                                            | Current owner and evidence                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Website route matching, navigation and document rendering | `start/routes/`, generated `start/routeTree.gen.ts`, `start/router.tsx`, and `createStartHandler` in `start/server.ts`.                                                                                                                                                                                                                  |
| Retained website HTTP protocols                           | Native route `server.handlers` call operations in `start/server/protocol-handlers.ts`. The HTTP inventory distinguishes these from obsolete website JSON endpoints.                                                                                                                                                                      |
| Method rejection                                          | `start/route-method-middleware.ts` and `start/server/route-method-policy.ts` inspect the matched Start route's handlers. They do not maintain a second URL dispatch table.                                                                                                                                                               |
| Website reads and mutations                               | `createServerFn` modules in `start/server/` call domain operations. `start/server/mutation-context.ts` centralizes authenticated identity, explicit organization binding and mutation write leases. Direct endpoint authorization remains necessary independently of navigation guards.                                                  |
| Shared request protections                                | `start/start.ts` installs Start request/function middleware. `start/server/document-policy.ts` applies organization denial, referral cookies and protocol write leases. Server functions skip the outer lease and enforce their own mutation lease.                                                                                      |
| Admin access                                              | Admin read functions call `start/server/admin-page-context.ts` before reading protected data. `start/server/admin-index.ts` checks authorization before redirecting to users. `start/server.ts` no longer dispatches authorization by an `/admin` pathname prefix. Admin mutation operations keep their separate role/permission checks. |
| Browser server state                                      | `start/page-query.ts`, resource query modules and mutation hooks use Query. Route loaders prepare the same query records used by components. This inventory does not establish that every invalidation dependency is correct.                                                                                                            |
| Document metadata                                         | Native routes/server readers select explicit semantic keys through `start/server/document-head.ts` and `universal/document-head.ts`. The metadata resolver no longer rematches URL patterns.                                                                                                                                             |
| URL creation                                              | `universal/routes.ts` supplies typed href builders. It is not the incoming request router.                                                                                                                                                                                                                                               |

The origin worker still owns infrastructure protocols such as MCP, OAuth/OIDC,
WebSockets and package-app hosting. The API worker owns the official REST API.
These do not need to become website server functions.

## Policies around Start's final response

`start/server.ts` supplies the request nonce and applies CSP/security headers,
cache policy, negotiated-document `Vary`, discovery headers, OAuth cookies and
status handling. It also strips HEAD bodies. These are deployment and HTTP
representation policies, not a second page router.

`start/http-entry.ts` establishes worker request/deferred-work context and error
reporting. It enforces `private, no-store` on the final RPC response, including
redirects serialized after request middleware returns. Its fatal-error path must
not redispatch a request that could already have committed a write.

These wrappers remain custom application code. Moving a policy into native
middleware is useful only if its timing still covers the final serialized
response, cookies, streaming status and error paths. They should not be counted
as removed simply because the renderer is Start.

## Remaining URL-shaped function inputs

Native transport does not automatically remove the old loader-oriented API
shape. These are concrete follow-up targets, not evidence of internal HTTP
fetches or a remaining Remix dispatcher:

| Modules under `start/server/`      | Remaining coupling                                                                 | Appropriate shape                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `oauth.ts`                         | OAuth authorize protocol parameters are forwarded through a reconstructed request. | Keep the external OAuth contract; separate protocol fields from the original authenticated request in the shared reader. |
| `org-alias.ts`                     | Destination URLs identify redirects.                                               | Retain URLs where navigation is the domain input.                                                                        |
| `static-page.ts`, metadata helpers | Pathnames identify static presentation/canonical URLs.                             | Pathnames are appropriate for operations about a page URL.                                                               |

Community and profile readers require typed filter inputs. Package reads retain
original requests and explicit resource identity. Community memoization includes
filter inputs even when reads share the same request. Session verification takes
organization scope from native matched routes and independently checks access.
Jobs, workflow cancellation, experiments and MCP OAuth client
creation/revocation use operation-specific typed inputs instead of action intent
dispatch.

Account collections, connection usage, credentials, and email take explicit
organization, record, selection and filter fields. The `loadCollection(href)`
helper and its fabricated destination Request are removed. Scoped and personal
read contexts keep the original authenticated request. Domain authorization
still runs independently of route navigation. Query mutation barriers,
invalidation and optimistic updates recognize typed organization inputs, keeping
actor and workspace boundaries intact.

Package-file readers take a discriminated resource input from native route
parameters. Location is separate and used for canonical redirects, login return
URLs and metadata, not resource selection. The unused packages-index read
function was deleted, its native alias route already owns that redirect.

The admin users reader uses explicit filters, page size, selected user and a
separate return destination. Pagination keys include actor and page size.
Billing completion takes organization and checkout session fields, checks the
original principal, and owns a write lease for both SSR and RPC. The outer
protocol boundary no longer leases billing success a second time. Login/signup
accepts only an optional return destination. Legacy org aliases retain
destination URLs because they are redirects, but session lookup uses the
original request.

Connect, consent and filtered admin readers separate validated resource inputs
from navigation destinations. OAuth callback restore preserves its
no-account-read branch. Organization management binds explicit slugs to the
original principal; repository reads use explicit filters. Account mutations
keep the original request and pass typed refresh/approval data to domain
operations. The obsolete URL-based secrets reader is removed. Shared domain
action dispatch still exists in several mutation operations and remains a
follow-up target for operation-level APIs, without reviving HTTP action
endpoints.

The separate signed-token cleanup slice keeps `start/server/action-page.ts` but
replaces generic `loadActionPage(href)` dispatch with `loadVerifyEmail`,
`loadVerifyEmailChange`, `loadVerifyEmailClaimRelease`,
`loadVerifyEmailDestination` and `loadUnsubscribeTips`. Inputs are typed tokens,
plus a return destination for email verification. Shared domain operations use
the original request context. Native routes retain non-consuming HEAD behavior
and disabled prefetch; unsubscribe keeps its external POST contract. The
implementation is included in this cleanup; runtime verification remains
dependent on CI.

## Remix imports that are utilities

Current examples are `remix/cookie` in `src/app/auth-session.ts`,
`oauth-login-state.ts`, `verify-session.ts` and `package-app-session.ts`;
`remix/data-schema` in environment/form/domain validation; `remix/data-table` in
database schema/query helpers; and `remix/html-template` / `remix/response/html`
in minimal error responses and package-app response helpers. These do not own
website route matching, hydration, data loading or navigation.

A repository-wide search also finds Remix component/router imports inside
`src/test-support/remix-package-app-fixture.ts`. Those are source strings for a
hosted package-app fixture, not Kody website runtime imports. The client and
worker TypeScript configurations use React JSX defaults; references to the
deleted backend router and SSR document have been removed.

## Evidence and limits

This audit comes from source inspection. The admin cleanup has server and
server-test TypeScript checks and lint checks; browser regressions were added to
`e2e/admin-rbac.spec.ts` for CI. Local runtime tests were not run at the user's
request. Deployment parity, HTTP status behavior and visual results still need
the corresponding CI and preview evidence. No claim of universal parity or a
measured performance gain follows from this ownership inventory.

## Remaining mutation API cleanup

Account integrations, connected agents, MCP server management, secrets, package
writes and organization management have named native operations. Several admin
forms and auth/billing inputs retain broad body records, and admin forms retain
operation selection inside native functions. Transport ownership alone does not
prove these APIs are idiomatic. Shared validation and business authorization are
useful; generic dispatch over unrelated actions is the cleanup target.

Against main `b24bb2ba2`, the deleted client router contains 1,352 lines, intent
prefetch contains 277 lines, and the deleted backend router contains 782 lines.
That is 2,411 lines across those three retired files, not a net migration size
claim. Native routes and operation code replace their responsibilities.

The exported shared secret reader uses `createServerOnlyFn`. This boundary keeps
credential services and the image renderer out of the browser graph. Package
operations preserve domain response status and structured recovery fields.
Organization people mutations invalidate actor-scoped typed organization query
keys, including the organization in each key.

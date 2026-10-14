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

| Modules under `start/server/`                                  | Remaining coupling                                                                                                                    | Appropriate next shape                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-platform-integrations.ts`, other filtered admin readers | Admin hrefs carry selected records, search and pagination. `readAdminPageContext` uses the href as the safe login return destination. | Separate typed query/record inputs from the relative return URL. Preserve role checks before domain reads.                                                                             |
| `connect.ts`, `connect-secret-set.ts`                          | Connection/approval parameters and optional organization scope arrive in a query string.                                              | Validated operation-specific fields with explicit organization scope. Provider callback state still needs protocol validation.                                                         |
| `mcp-server-authorize.ts`                                      | Hrefs are parsed and reconstructed as Requests for existing consent/checkout operations.                                              | Explicit consent/checkout inputs and shared policy/domain operations. Preserve authenticated organization binding, callback verification, one-time behavior and GET/HEAD distinctions. |
| `shell.ts`, `org-alias.ts`                                     | Destination URLs carry organization selection, redirect intent or auth view state.                                                    | Retain URLs where navigation is the actual domain input; separate resource/auth inputs where it is merely a transport convenience.                                                     |
| `static-page.ts`, metadata helpers                             | Pathnames identify static presentation/canonical URLs.                                                                                | No automatic rewrite needed. A pathname is appropriate when the operation is about a page URL itself.                                                                                  |

Account collections, connection usage, credentials, and email now take explicit
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

Admin users now uses explicit filters, page size, selected user and a separate
return destination. Pagination keys include actor and page size. Billing
completion takes organization and checkout session fields, checks the original
principal, and owns a write lease for both SSR and RPC. The outer protocol
boundary no longer leases billing success a second time. Login/signup accepts
only an optional return destination. Legacy org aliases retain destination URLs
because they are redirects, but session lookup uses the original request.

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
worker TypeScript configurations now use React JSX defaults; references to the
deleted backend router and SSR document have been removed.

## Evidence and limits

This audit comes from source inspection. The admin cleanup has server and
server-test TypeScript checks and lint checks; browser regressions were added to
`e2e/admin-rbac.spec.ts` for CI. Local runtime tests were not run at the user's
request. Deployment parity, HTTP status behavior and visual results still need
the corresponding CI and preview evidence. No claim of universal parity or a
measured performance gain follows from this ownership inventory.

# Web app rendering and server state

The web app uses TanStack Start, Router, Query, and Redact. The existing worker
services and HTTP API handlers remain the server boundary.

[`getRouter`](../../packages/worker/start/router.tsx) creates a QueryClient for
each server request and each browser router, then installs Router's SSR Query
integration. Router owns matching, navigation, preloading, scroll restoration,
and document assets. Query owns reusable page payloads. Route loaders retain a
head fallback and the exact Query key, rather than a second copy of the payload.
One-time authorization, verification, and approval pages use foreground Router
loaders so their token results do not become reusable server-state caches.

## Reads and navigation

[`createPageQuery`](../../packages/worker/start/page-query.ts) builds shared
query options for loaders and mounted components. Keys contain the actor,
resource, and normalized resource inputs, including organization and filters
where applicable. The organizations routes share
[`organizationsQuery`](../../packages/worker/start/organizations-query.ts).

A fresh cache hit needs no payload request. An ordinary stale cache hit renders
the retained data and revalidates in the background. A cache miss waits for the
payload. Explicit invalidation waits for authoritative data unless an optimistic
write is still pending. Query receives its own cancellation signal, so canceling
one navigation does not abort a read needed by another observer.

Private navigation also verifies identity. That same request checks access to
the destination organization, so an authorized warm navigation can reuse its
cached payload without a second permission request. Permission-sensitive queries
use `freshAuthorization` to require a foreground server check even after
preload. This is a deliberate security cost, so a warm private navigation is not
a promise of zero server requests. Server functions independently enforce
access. Presentation-only Jobs and Values filters reuse the committed page
authorization. Known static public pages skip that verification request.

The app disables Query's default focus and reconnect refetches. Its
[`activation handler`](../../packages/worker/start/refresh-on-activation.ts)
checks identity before refreshing private data. This avoids returning a new
account's data into a previous account's mounted document.

## Writes

Mutation lifecycle callbacks own cache updates and reconciliation, including
after the submitting component unmounts. Submitted variables retain their actor,
organization, location, and exact query key. UI callbacks such as navigation
remain tied to the mounted submitter.

[`acceptedPageMutationOptions`](../../packages/worker/start/accepted-page-mutation.ts)
publishes accepted responses to the exact submitted cache entry and invalidates
related resources. A lost response still triggers reconciliation because the
server may have committed the write. Payloads that share a resource name but
have different shapes cannot overwrite each other.

Optimistic resources use
[`mutation barriers`](../../packages/worker/start/page-mutation-cache.ts) to
prevent a background read from replacing optimistic data with pre-write data.
Organization and package barriers only delay reads of the matching resource.
Forms retain local drafts; saved server data comes from Query. Secrets and
one-time revealed credentials stay outside reusable page caches.

## Remaining custom code and checks

Actor verification, organization scoping, mutation dependencies, and
cache-driven head updates express Kody behavior. These are application code, not
features that adopting Start removes. The HTTP router and shared URL builders
still use Remix. Those builders only construct paths, they do not own browser
navigation. User-authored package apps may also use Remix independently of
Kody's web UI.

Local [Redact](../../patches/@tanstack+redact+0.1.4.patch) and
[Router](../../patches/@tanstack+router-core+1.171.34.patch) patches are part of
the dependency maintenance cost. Upstream reviews are open for the
[Redact fixes](https://github.com/TanStack/redact/pull/43) and
[Router transition rejection](https://github.com/TanStack/router/pull/8703). The
Router proposal is narrower than the local patch: it handles a skipped animation
without retrying the navigation callback. The Redact patch removes its global
hydration scroll interceptor, which suppressed legitimate Router restoration
after user scrolling. The hydration scroll regression compares the same behavior
against React, including immediate navigation after a real wheel event. It also
sends queued updates through their Suspense boundary when an earlier ancestor
update has retained the subtree. Without that check, a departing Router match
could render after its store was cleared while the replacement route suspended.
The [paired Router regression](../../e2e/start/router-retained-match.spec.ts)
passes with React, fails with uncorrected Redact, and passes with the fix,
including resuming the replacement. The failed feature module recovery test also
checks that document recovery emits no unexpected client errors. Browser
regressions under [`e2e/start`](../../e2e/start) cover cache freshness, identity
changes, background errors, metadata, and renderer behavior.

`npm run build` verifies Redact in both bundles and rejects Kody's retired
renderer and client router. `npm run validate` runs the complete local gate. SSR
Query dehydration includes successful and pending queries, preserving streaming,
and excludes settled errors such as authorization redirects. Auxiliary protected
reads start only after their parent resource authorizes.

Passing that gate does not replace authenticated preview testing or matched
production performance measurements.

### Pending navigation audit

Connections uses its matched route context for page identity. Reading the global
location while the previous page remains visible can combine its retained data
with the destination URL. The browser regression in
[`cache-navigation.spec.ts`](../../e2e/start/cache-navigation.spec.ts) holds the
destination request pending and checks that Connections stays valid on Back.

The same global-location pattern still needs regression coverage and correction
in Secrets, Jobs, Values, Workflows, Memories, Email, MCP servers, admin users,
and authentication forms. These are source-audit findings, not confirmed browser
reproductions. Keep the full matched page URL separate from the normalized Query
input: Jobs deliberately excludes local `q` and `view` filters from its server
cache key, so substituting that key as its display URL would lose those filters.

# Framework comparison

The current [private decision evaluation](reports/PRIVATE-DECISION-PROGRESS.md)
records matched app save and freshness experiments, remaining gaps, and the
Access credential needed for updated edge measurements. Its
[decision protocol](PRIVATE-DECISION-PROTOCOL.md) treats app experience as the
main benefit and public-page delivery and SEO as guardrails.

The latest [TkDodo refactor](reports/TKDODO-REFACTOR.md) records the changes
based on all 91 published blog posts, with a
[reading record](reports/TKDODO-READING.json). The earlier
[cache comparison](reports/QUERY-CACHE-COMPARISON.md) records the v3
implementation and its measurements. Its timings are historical evidence, not
results for the latest refactor. The
[implementation details](reports/QUERY-CACHE-IMPLEMENTATION.md),
[validation evidence](reports/QUERY-CACHE-VALIDATION.md), and
[source accounting](reports/QUERY-CACHE-COMPLEXITY.md) describe that earlier
pass.

The earlier [Query comparison](reports/QUERY-COMPARISON.md) remains historical
evidence, not a measurement of the subsequent cache and renderer changes. The
private previews below still run the earlier builds.

Read the [comparison and recommendation](reports/COMPARISON.md),
[verification results](reports/VERIFICATION.md), and
[route audit](reports/ROUTE-COVERAGE.md).

The [Router follow-up](reports/ROUTER-FOLLOW-UP.md) covers the contained
freshness and cancellation changes,
[type and complexity checks](reports/TYPE-COMPLEXITY.md),
[matched agent experiment](reports/AGENT-COMPARISON.md), and
[Intent setup](reports/INTENT-SETUP.md). Its long-session measurements are
tracked separately from the earlier edge comparison.

Private Cloudflare previews, restricted to Tanner's Access identity:

- [TanStack Start with Redact](https://kody-branch-compare-start.thetanstack.workers.dev)
- [Immutable Remix baseline](https://kody-branch-compare-remix.thetanstack.workers.dev)

The [edge protocol](EDGE-FINAL-PROTOCOL.md) records timing conditions and
limits. The [private deployment guide](PRIVATE-DEPLOYMENT.md) records the
isolated setup. Production Kody is unchanged.

Baseline source: `8b2528460`. The baseline is an isolated Git archive at
`/tmp/kody-framework-baseline`, with its own cloned dependencies. Never compare
new source against an old build made with newly resolved dependencies.

Run the same harness against each checkout, on the same machine, with no other
builds running:

```sh
node tools/framework-comparison/measure-build.mjs /path/to/checkout remix /tmp/results 3
node tools/framework-comparison/measure-build.mjs /path/to/other-checkout start /tmp/results 3
```

The JSON records successful build assets, raw and gzip bytes, source line
counts, Node version, machine details, exit codes and elapsed time. Logs
preserve build warnings. A failed build produces no asset measurements,
preventing stale build output from masquerading as a successful comparison. The
first build is reported separately from later warm runs. Gzip totals are
per-file compressed bytes.

Use production builds for Lighthouse and browser performance measurements. Local
Vite development measurements cannot establish production performance. Pin
Chrome, Lighthouse, viewport, CPU and network throttling, use the same seeded
database and run each page at least five times. Report medians and ranges,
including failures. Do not compare a deployed production server to local
development.

Required browser scenarios:

- Direct loads and client navigation across home, pricing, docs, blog,
  community, profiles, onboarding and authenticated account pages.
- Browser back/forward, query strings, hash links, scroll restoration, pending
  navigation, error responses and canceled navigation.
- Change a record, navigate away and back, verify updated data. Repeat with two
  tabs and another user to check freshness and isolation.
- Authentication, logout, expired sessions, permissions and admin denial.
- Keyboard navigation, focus after navigation, reduced motion, mobile layout,
  empty states, populated states and JavaScript-disabled public rendering.

For navigation, measure click to destination content ready, not only URL change.
Record full document reloads, requests, transferred bytes, long tasks and
errors. For freshness, assert the actual new value appears after a mutation and
record the time to visibility. Passing navigation timing alone does not prove
freshness.

Lighthouse performance, accessibility, best practices and SEO scores must retain
raw reports. Also record LCP, CLS, TBT, FCP and Speed Index, initial JS/CSS
transfer, server TTFB, request count and console errors. Lighthouse does not
prove functional parity. The authoritative local gate remains
`npm run validate`, supplemented by logged-in browser testing with data and
preview verification.

No finite test set guarantees 100% parity or absence of unknown bugs. A
migration recommendation needs measured improvements, all required behavior
passing and explicit remaining gaps. A smaller line count is not evidence of
lower complexity if behavior was removed or hidden in compatibility code.

## Running the native candidate

The native candidate covers the public and authenticated web app, including
admin screens. Start owns document rendering and unknown-page responses.
`start/backend-router.ts` retains the existing API, action, redirect and
protocol handlers. No page falls back to the original Remix frontend, and the
candidate no longer needs original compiled assets.

Start is the default application build. Run the baseline from its separate
checkout. Use these commands with Node 26 on PATH:

```sh
npm run dev
npm run build
npm run typecheck:start
node tools/framework-comparison/verify-redact-build.mjs
npm run test:e2e:run
```

For local test data:

```sh
node tools/prepare-e2e-env.ts
CLOUDFLARE_ENV=test node tools/apply-local-app-migrations.ts
CLOUDFLARE_ENV=test node tools/seed-test-data.ts --local --env test
PORT=5174 CLOUDFLARE_ENV=test node --env-file=packages/worker/.env node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174
```

Verify authentication with
`node tools/control-kody.ts login --origin http://127.0.0.1:5174`. The `.env`
load supplies local cookie signing and other required bindings. Development and
migration tools share `.wrangler/state` unless `WRANGLER_PERSIST_TO` selects
another directory. Do not run dev and E2E servers while both rewrite the same
local Worker configuration.

`npm run typecheck:start` compiles worker-side server functions into ignored
generated declarations, then checks native browser components with DOM types
against those contracts. This keeps Cloudflare HTMLRewriter's global `Element`
type out of browser code. Native routes import server functions through
`#start/server/*`; Vite resolves the implementation and browser type checking
resolves its generated declaration. The authoritative `npm run validate` also
runs native type checking through `npm run typecheck`. The default Playwright
suite runs both the existing parity specs and the additional Start tests against
Start. Tests under `e2e/start` cover cache freshness, mutation reconciliation,
document metadata, and Redact behavior.

Production output uses `dist`. Measure the default build with:

```sh
node tools/framework-comparison/measure-build.mjs /path/to/checkout start /tmp/results 3
```

Keep baseline and candidate artifacts separate. Production-mode local benchmarks
use identical local test bindings, not production credentials or data. Retained
API handlers still use Remix's request router; this experiment replaces the web
UI and its document routing, not the backend services or user-authored package
apps.

## Redact runtime

The Start candidate uses `@tanstack/redact` 0.1.4, matching
[tanstack.com's Vite integration](https://github.com/TanStack/tanstack.com/blob/main/vite.config.ts).
Its default full preset aliases React APIs, DOM, scheduler and JSX entry points.
Explicit server-variant aliases and SSR bundling keep Cloudflare on the same
runtime. Application imports and React type declarations stay unchanged.

Every `build` runs `verify-redact-build.mjs` to check client and server source
maps for Redact and rejects upstream React runtime modules. Old measurements
remain separate from the new `reports/measurements/redact` results.

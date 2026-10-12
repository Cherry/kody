# Remix HTTP and package-app guidance

Kody's web UI uses [TanStack Start, Router, and Query](./tanstack-start.md).
Remix remains in the HTTP API layer and as an optional framework for
user-authored package apps. Load `.agents/skills/remix/SKILL.md` when changing
those Remix contracts. UI navigation and page data follow the Start guide.

The installed Remix docs are canonical: search `node_modules/remix/INDEX.md`,
then read the matching guide under `node_modules/remix/guides/` and the package
README. Do not vendor copies here.

## Kody runtime topology

The origin request path reaches `packages/worker/start/http-entry.ts`, which
dispatches APIs through `packages/worker/start/backend-router.ts` and documents
through Start. Wrangler supplies Fetch API requests. Origin does not use the
Node HTTP server from `remix new`, and Node-only `trustProxy` does not apply.

The backend uses Remix's request router and cross-origin protection middleware.
Session cookies use `remix/cookie`. D1 access uses `D1DatabaseDriver` with
`new Database(driver)`. Server authorization stays in the API and data service
handlers, regardless of client cache state.

Package apps are framework-agnostic Worker entries on `kody-runtime`, in dynamic
Worker Loader isolates. A Remix package declares `remix` as an ordinary npm
dependency; the platform does not inject it. The package's `app/router.ts`
default-exports its fetch handler. `kody:runtime` supplies named exports and the
optional `KodyRuntime` request-context key.

Package apps use the runtime esbuild bundler, without Vite HMR or
`remix/assets`. Their browser entry is a platform-built module under `/_assets`,
hydrated through a `loadModule` registry. See
[package-app authoring](../guides/package-apps.md) and
[platform implementation](./packages-and-manifests.md#package-apps).

Usernames are DNS labels for package-app hosts and cannot contain dots. Use
`href()` for HTTP route parameters that can contain dots, such as secret names,
so path matching receives the encoded parameter.

## Adding a page

Add web pages through the native routes under `packages/worker/start/routes`.
Follow [server-state ownership](./tanstack-start.md) and
[no-flash navigation](./no-flash-navigation.md). HTTP API endpoints belong in
`packages/worker/start/backend-router.ts`; they do not render an alternate UI.

OAuth authorize/callback paths belong to the Cloudflare OAuth provider wrapper
and use `packages/worker/universal/oauth-paths.ts`.

Database leftovers, dual writes, and later schema drops follow
[cleanup after migrations](./cleanup-after-migrations.md).

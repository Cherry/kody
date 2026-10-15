# Start opt-in deployment

The migration branch stays unmerged. The current production worker remains the
default and keeps its existing custom domain, background jobs and resource
ownership. A separate, immutable Start worker shares the existing production
resources. A routing worker can be activated on `kody.codes/*` after both
workers are verified.

Only the two approved stable person IDs may opt in. Resolve those IDs from the
production accounts for `tannerlinsley` and Kent, review the usernames and IDs
together, then supply the two IDs to the generator. Do not use usernames as
signed identity claims.

## Generate the review bundle

Use an existing, resolved production Wrangler config. Do not run
`production-resources ensure`, a migration command, or any resource provisioning
command for this rollout.

```sh
node tools/ci/start-rollout-config.ts \
  resolved-production.json \
  packages/start-routing-worker/wrangler.jsonc \
  FULL_SOURCE_COMMIT_SHA \
  approved-person-ids.json \
  emitted-asset-paths.json \
  rollout-review.json
```

The last two input files contain JSON arrays. Asset paths must come from the
candidate's emitted client files, relative to its client directory. The router
exposes only those exact static paths beneath `/__start/<release>/`. This list
must never include server function paths.

The output has `candidate`, `router` and `manifest` sections. It is a review
bundle, not a single Wrangler config. Write the two configs to their proper
build locations, preserving relative path resolution. Build the candidate from
the pinned source SHA with its isolated release asset prefix. Replace the source
production `main` and `assets.directory` with the resulting candidate build
paths, and verify the resulting bundle before deployment. Never deploy the old
production entry as the candidate.

The candidate config removes routes, scheduled triggers, queue consumers and
migrations. Existing DO and workflow bindings must already reference their
owning production scripts, otherwise generation fails. Queue producers, database
IDs, bucket names, service entrypoints and external workflow bindings stay
unchanged. Both workers disable workers.dev and preview URLs. The router config
has no routes, so deploying it does not activate traffic routing.

## Secrets and activation

Cloudflare cannot return existing secret values. Obtain the production secrets
from their trusted source and install them on the candidate securely. In
particular, `COOKIE_SECRET` and stored credential encryption keys must match
production. The router needs the same `COOKIE_SECRET` and a separate
`START_ROLLOUT_SECRET` of at least 32 characters. Never rotate live secrets to
make rollout deployment easier. Stop if the existing values are unavailable.

Before activating the zone route, verify the pinned build, shared resource
bindings, session compatibility, protocol routing, exact asset list, allowed
accounts and private cache policy. Verify signed-out requests and a noneligible
account stay on legacy, and each eligible account also stays on legacy until
choosing opt in. Verify opt out returns to legacy and stale Start tabs cannot
bypass the identity checks. Existing session cookies must work on both stacks.

Activation is a separate Cloudflare zone route change. Record the existing route
table before changing it. Removing only the rollout zone route restores the
existing production custom domain immediately. Do not delete or replace the
legacy worker, its custom domain, resources, migrations, secrets or background
consumers.

## Inactive worker deployment mode

The existing production workflow accepts `prepare-start-opt-in` and
`deploy-start-opt-in` on the migration branch. Both require the dispatch SHA to
equal the current open PR 3561 head and require the latest Validate run for that
exact source commit to pass. Neither mode runs the normal production deployment
jobs.

Preparation only produces a review artifact. Inactive deployment builds and
verifies the same isolated release, rereads production bindings to reject
resource drift, and refuses to overwrite any existing candidate or router
worker. The exact names are `kody-start-<full-source-sha>` and
`kody-start-router`.

The deployment step obtains existing production secrets directly from GitHub.
Every live secret name needs an explicit reviewed mapping and a nonempty trusted
value. Cookie and credential encryption secrets are mandatory. Wrangler's
`--secrets-file` supplies secrets with the initial deployment, avoiding a
separate draft worker created by secret sync. The temporary file has mode 0600
and is removed afterward, secret values are not included in artifacts or
application build environment variables. The router gets only the shared cookie
secret and a separate generated, masked rollout secret.

If deployment partially succeeds, another run refuses to overwrite either
existing worker. Review the partial result before deciding how to continue.
Inactive deployment checks that workers.dev and preview URLs remain disabled. It
does not activate the zone route or claim browser parity against the production
data plane.

import { loadOrgBindingForSlug, type OrgBinding } from '#worker/orgs/repo.ts'
import { readOrgSlugFromUrl } from '#universal/org-binding/url.ts'
import {
	orgOwnedSectionForPath,
	orgSlugFromOrgOwnedPath,
	type OrgOwnedAccountSection,
} from '#universal/org-pages.ts'
import { routes } from '#universal/routes.ts'

export type RequestOrgResolution = OrgBinding | 'personal' | 'denied'

const resolutions = new WeakMap<Request, Promise<RequestOrgResolution>>()

/** Organization pages and explicit OAuth/download query scopes bind the session principal. */
export function loadRequestOrgResolution(
	request: Request,
	env: Env,
	personId: string,
): Promise<RequestOrgResolution> {
	const cached = resolutions.get(request)
	if (cached) return cached
	const pending = resolveRequestOrg(request, env, personId)
	resolutions.set(request, pending)
	return pending
}

/**
 * Why `/@slug/-/<section>` is closed to this person, or null when it is open.
 */
export function orgSectionDenial(
	resolution: RequestOrgResolution,
	section: OrgOwnedAccountSection,
): string | null {
	if (resolution === 'denied' || resolution === 'personal') {
		return 'Organization unavailable'
	}
	// A grant without a membership is not access to the whole workspace.
	// Connections only lists the viewer's own agents bound to this org, which
	// is how a collaborator starts using what was shared with them.
	if (resolution.role == null && section !== 'agents') {
		return 'Organization resources unavailable'
	}
	return null
}

/** Organization-owned document and protocol paths. */
export function isOrgBoundPath(pathname: string): boolean {
	return orgSlugFromPageUrl(pathname) !== null
}
/**
 * True when this request can bind a non-signup org: an org-bound path, or
 * `/connect/oauth?org=<slug>` (the OAuth redirect URI stays path-org-less).
 * An explicit empty/invalid `org=` is also bound so the guard can deny it
 * instead of falling through to the signup org.
 */
export function isOrgBoundRequest(url: URL): boolean {
	return (
		isOrgBoundPath(url.pathname) ||
		hasInvalidExplicitOrg(url) ||
		orgSlugFromExplicitOrgUrl(url) !== null
	)
}

function hasInvalidExplicitOrg(url: URL): boolean {
	return (
		hasExplicitOrgQuery(url.pathname) &&
		url.searchParams.has('org') &&
		readOrgSlugFromUrl(url) === null
	)
}

/**
 * True when this request names an org the person cannot use: an `/@slug/-/…`
 * URL for an org they neither belong to nor hold a grant in, or a section URL
 * (page or export download) that
 * {@link orgSectionDenial} closes to them. `readAuthenticatedAppUser` falls
 * back to the signup org for a denied org, so these requests must stop before
 * any handler runs. Billing and management URLs only need the org; their
 * handlers check the permission.
 */
export async function isOrgRequestDenied(
	request: Request,
	env: Env,
	personId: string,
): Promise<boolean> {
	const url = new URL(request.url)
	if (!isOrgBoundRequest(url)) return false
	const resolution = await loadRequestOrgResolution(request, env, personId)
	if (resolution === 'denied') return true
	if (resolution === 'personal') return false
	const section = orgOwnedSectionForPath(url.pathname)
	return section !== null && orgSectionDenial(resolution, section) !== null
}

function orgSlugFromPageUrl(pathname: string): string | null {
	return orgSlugFromOrgOwnedPath(pathname)
}

/** OAuth uses a fixed callback URL, downloads use an explicit org query. */
function hasExplicitOrgQuery(pathname: string) {
	return (
		pathname === routes.connectOauth.href() ||
		pathname === routes.accountMemoriesExport.href()
	)
}
function orgSlugFromExplicitOrgUrl(url: URL): string | null {
	return hasExplicitOrgQuery(url.pathname) ? readOrgSlugFromUrl(url) : null
}

async function resolveRequestOrg(
	request: Request,
	env: Env,
	personId: string,
): Promise<RequestOrgResolution> {
	const url = new URL(request.url)
	if (hasInvalidExplicitOrg(url)) return 'denied'
	const slug =
		orgSlugFromPageUrl(url.pathname) ?? orgSlugFromExplicitOrgUrl(url)
	if (!slug) return 'personal'
	const binding = await loadOrgBindingForSlug(env.APP_DB, personId, slug)
	return binding ?? 'denied'
}

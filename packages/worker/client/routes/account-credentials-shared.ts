import { buildAccountSecretPath } from '@kody-internal/shared/account-secret-route.ts'
import { createListDetailRoute } from '#client/list-detail-route.ts'

import {
	type CredentialListFilters,
	type CredentialListItem,
} from '#universal/credential-contracts.ts'
import {
	type AccountCredentialsResponse,
	readCredentialListFilters,
	writeCredentialListQuery,
} from '#universal/credentials-list.ts'
import { orgResourcePath, orgSlugFromPathname } from '#universal/org-pages.ts'

export const credentialsRoute = createListDetailRoute('/account/credentials')

/**
 * One payload per org and selection; filters only change which rows show.
 * The org comes from the page path because the fetch binds it by referrer.
 */
export function credentialsDataKey(href: string) {
	const orgSlug =
		orgSlugFromPathname(new URL(href, 'http://localhost').pathname) ?? ''
	const selectedId = credentialsRoute.getSelection(href).selectedId
	const key = `/account/credentials?org=${encodeURIComponent(orgSlug)}`
	return selectedId ? `${key}&selected=${encodeURIComponent(selectedId)}` : key
}

export function readCredentialListFiltersFromHref(href: string) {
	return readCredentialListFilters(
		new URL(href, 'http://localhost').searchParams,
	)
}

/** `href` with `filters` as its query, keeping unrelated params. */
export function writeCredentialListFilters(
	href: string,
	filters: CredentialListFilters,
) {
	const url = new URL(href, 'http://localhost')
	writeCredentialListQuery(url.searchParams, filters)
	return `${url.pathname}${url.search}`
}

/**
 * The page that edits `credential` today. Personal credentials granted to a
 * team org are managed in the viewer's personal org.
 */
export function credentialManageHref(
	credential: CredentialListItem,
	page: Pick<AccountCredentialsResponse, 'orgSlug' | 'personalOrgSlug'>,
) {
	const slug =
		credential.scope === 'personal' && page.personalOrgSlug
			? page.personalOrgSlug
			: page.orgSlug
	switch (credential.kind) {
		case 'secret':
		case 'url':
		case 'login':
		case 'signing':
			return orgResourcePath(
				slug,
				'secrets',
				buildAccountSecretPath(
					credential.packageId
						? {
								name: credential.name,
								scope: 'package',
								packageId: credential.packageId,
							}
						: { name: credential.name, scope: 'user' },
				).replace(/^\/account\/secrets\/?/, ''),
			)
		case 'oauth':
			return orgResourcePath(
				slug,
				'integrations',
				encodeURIComponent(credential.name),
			)
		case 'mcp':
			return orgResourcePath(
				slug,
				'mcp-servers',
				encodeURIComponent(credential.id),
			)
		default: {
			const exhaustive: never = credential.kind
			return exhaustive
		}
	}
}

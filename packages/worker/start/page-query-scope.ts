import { type Query } from '@tanstack/react-query'
import {
	parseOrgResourcePath,
	parseOrgUsagePath,
	parseOrgBillingPath,
} from '#universal/org-pages.ts'
import { pageResourceKey } from './page-mutation-cache.ts'

export function pageQueryOrg(href: string) {
	const pathname = new URL(href, 'https://kody.local').pathname
	return (
		parseOrgResourcePath(pathname)?.slug ??
		parseOrgUsagePath(pathname)?.slug ??
		parseOrgBillingPath(pathname)?.slug ??
		null
	)
}

/** Actor identity is shared across orgs, resource payloads are not. */
export function scopedPageResource(
	actorKey: string | null,
	resource: string,
	href: string,
) {
	const org = pageQueryOrg(href)
	return {
		queryKey: pageResourceKey(actorKey, resource),
		predicate: (query: Query) => pageQueryInputOrg(query.queryKey[3]) === org,
	}
}

export function pageQueryInputOrg(value: unknown): string | null {
	if (typeof value === 'string')
		return (
			pageQueryOrg(value) ??
			/^\/@([^/]+)(?:\/|$)/.exec(
				new URL(value, 'https://kody.local').pathname,
			)?.[1] ??
			null
		)
	if (value && typeof value === 'object') {
		if ('orgSlug' in value && typeof value.orgSlug === 'string')
			return value.orgSlug
		if ('href' in value && typeof value.href === 'string')
			return pageQueryInputOrg(value.href)
	}
	return null
}

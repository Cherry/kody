import { createListDetailRoute } from '#client/list-detail-route.ts'
import { formatIntegerNumber } from '#client/charts/chart-theme.ts'
import { isUnlimitedLimit } from '#universal/plans.ts'

import {
	isAdminUserVerificationFilter,
	type AdminUserVerificationFilter,
} from '#universal/email-verification-delivery.ts'

const adminUsersApiPath = '/admin/users.json'
export const adminUserUsageApiPath = '/admin/users/usage.json'
export const adminUserCreditsApiPath = '/admin/users/credits.json'

const { getSelection, buildDetailHref } = createListDetailRoute('/admin/users')

export { getSelection }

export function formatUsageLimit(limit: number) {
	return isUnlimitedLimit(limit) ? 'Unlimited' : formatIntegerNumber(limit)
}

export function formatUsagePercent(value: number | null) {
	if (value === null) return '—'
	return `${Math.round(value * 100)}%`
}

export type AdminUserFilterState = {
	search: string
	role: string
	verification: AdminUserVerificationFilter | ''
}

/** Read the `q`/`role`/`verification` filter params the server applies. */
export function readFilterState(href: string): AdminUserFilterState {
	const url = new URL(href, 'http://localhost')
	const rawVerification = url.searchParams.get('verification')?.trim() ?? ''
	return {
		search: url.searchParams.get('q')?.trim() ?? '',
		role: url.searchParams.get('role')?.trim() ?? '',
		verification: isAdminUserVerificationFilter(rawVerification)
			? rawVerification
			: '',
	}
}

/**
 * The list window only depends on the filters, not on which user is
 * selected — selection-only navigations keep the loaded scroll window.
 */
export function getListKey(href: string) {
	const filters = readFilterState(href)
	return `q=${filters.search}&role=${filters.role}&verification=${filters.verification}`
}

export function buildUserDetailHrefFrom(
	currentHref: string,
	stableUserId: string,
) {
	const url = new URL(currentHref, 'http://localhost')
	url.searchParams.delete('page')
	return buildDetailHref(stableUserId, url.search)
}

export function parseSelectedStableUserId(value: string | null): string | null {
	if (!value || !/^[a-f0-9]{64}$/.test(value)) return null
	return value
}

/**
 * Translate a detail pathname into the JSON API's `?selected=` param and
 * drop a stale `?page=` so initial loads always re-anchor at page one.
 */
export function buildAdminUsersApiRequestUrl(
	href: string,
	options?: { page?: number; includeSelected?: boolean },
) {
	const pageUrl = new URL(href, 'http://localhost')
	const requestUrl = new URL(adminUsersApiPath, 'http://localhost')
	requestUrl.search = pageUrl.search
	requestUrl.searchParams.delete('page')
	if (options?.page != null) {
		requestUrl.searchParams.set('page', String(options.page))
	}
	const selectedId = getSelection(href).selectedId
	if (selectedId && options?.includeSelected !== false) {
		requestUrl.searchParams.set('selected', selectedId)
	} else {
		requestUrl.searchParams.delete('selected')
	}
	return `${requestUrl.pathname}${requestUrl.search}`
}

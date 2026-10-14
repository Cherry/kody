import { createListDetailRoute } from '#client/list-detail-route.ts'
import { formatIntegerNumber } from '#client/charts/chart-theme.ts'
import { isUnlimitedLimit } from '#universal/plans.ts'

import {
	isAdminUserVerificationFilter,
	type AdminUserVerificationFilter,
} from '#universal/email-verification-delivery.ts'

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

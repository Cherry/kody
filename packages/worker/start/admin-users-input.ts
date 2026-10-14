import { parsePersonId } from '@kody-internal/shared/owner-person-ids.ts'

/** URL search is decoded once at the navigation boundary, not inside the RPC. */
export function adminUsersFilters(search: string) {
	const params = new URLSearchParams(search)
	const pageSize = Number.parseInt(params.get('pageSize') ?? '', 10)
	return {
		query: params.get('q')?.trim() ?? '',
		role: params.get('role')?.trim() ?? '',
		verification: params.get('verification')?.trim() ?? '',
		pageSize:
			Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
	}
}

export function adminUsersSelection(search: string, pathStableUserId?: string) {
	return (
		parsePersonId(pathStableUserId) ??
		parsePersonId(new URLSearchParams(search).get('selected'))
	)
}

/** Route search is normalized once, before it becomes a Query key or RPC input. */
export function memoriesInput(
	orgSlug: string,
	search: string,
	memoryId?: string,
) {
	const params = new URLSearchParams(search)
	const deleted = params.get('includeDeleted')?.trim().toLowerCase()
	return {
		orgSlug,
		memoryId,
		selected: params.get('selected')?.trim() || undefined,
		query: params.get('q')?.trim() ?? '',
		includeDeleted: deleted === '1' || deleted === 'true' || deleted === 'yes',
	}
}

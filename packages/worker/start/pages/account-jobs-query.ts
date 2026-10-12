import { jobsRoute } from './account-jobs-shared.ts'

/** Lists and the accepted detail are complete; other details need a fresh read. */
export function needsJobDetailRefresh(
	href: unknown,
	acceptedSelection: unknown,
) {
	if (typeof href !== 'string') return true
	const selected =
		jobsRoute.getSelection(href).selectedId ??
		new URL(href, 'http://localhost').searchParams.get('selected')?.trim() ??
		null
	return selected !== null && selected !== '' && selected !== acceptedSelection
}

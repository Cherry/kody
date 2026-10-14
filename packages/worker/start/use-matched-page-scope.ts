import { useRouteContext } from '@tanstack/react-router'

/** Identity belongs to the nearest rendered match, including retained pages. */
export function useMatchedPageScope() {
	const { actorKey, pageLocation } = useRouteContext({ strict: false })
	if (actorKey === undefined || !pageLocation) {
		throw new Error(
			'A rendered page requires its matched identity and location.',
		)
	}
	return { actorKey, pageLocation }
}

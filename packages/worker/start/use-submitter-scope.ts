import { useMatchedPageScope } from './use-matched-page-scope.ts'
import { useEffect, useRef } from 'react'

/** UI effects belong to the form that submitted, even after leaving and returning. */
export function useSubmitterScope() {
	const { actorKey, pageLocation } = useMatchedPageScope()
	const href = pageLocation.href
	const current = useRef<object | null>(null)
	useEffect(() => {
		current.current = {}
		return () => {
			current.current = null
		}
	}, [actorKey, href])
	return () => {
		const submission = current.current
		return () => submission !== null && current.current === submission
	}
}

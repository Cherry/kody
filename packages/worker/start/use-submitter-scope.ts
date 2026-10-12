import { useEffect, useRef } from 'react'
import { useLocation, useRouteContext } from '@tanstack/react-router'

/** UI effects belong to the form that submitted, even after leaving and returning. */
export function useSubmitterScope() {
	const { actorKey } = useRouteContext({ from: '__root__' })
	const href = useLocation({ select: (location) => location.href })
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

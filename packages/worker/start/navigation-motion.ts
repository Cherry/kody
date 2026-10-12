import {
	type AnyRouter,
	type createMemoryHistory,
} from '@tanstack/react-router'
import { shouldUseViewTransition } from '#universal/navigation-motion.ts'

type MotionEnvironment = {
	canStart: () => boolean
	prefersReducedMotion: () => boolean
	hasPersistentShell: () => boolean
	markSpaNavigation: () => void
}

/** Use foreground lifecycle events, covering links, history and redirects.
 * Keep the policy boolean so browsers without typed view transitions obey it. */
export function installNavigationMotion(
	router: Pick<AnyRouter, 'subscribe' | 'update'> & {
		history: ReturnType<typeof createMemoryHistory>
	},
	environment: MotionEnvironment,
) {
	let isHistoryTraversal = false
	const stopHistory = router.history.subscribe(({ action }) => {
		isHistoryTraversal =
			action.type === 'BACK' ||
			action.type === 'FORWARD' ||
			action.type === 'GO'
	})
	const stopBefore = router.subscribe('onBeforeNavigate', (event) => {
		const from = event.fromLocation
		router.update({
			defaultViewTransition:
				!isHistoryTraversal &&
				Boolean(from) &&
				shouldUseViewTransition({
					from: from ? `${from.pathname}${from.searchStr}` : null,
					to: `${event.toLocation.pathname}${event.toLocation.searchStr}`,
					canStart: environment.canStart(),
					prefersReducedMotion: environment.prefersReducedMotion(),
					hasPersistentShell: environment.hasPersistentShell(),
				}),
		})
	})
	const stopMount = router.subscribe('onBeforeRouteMount', (event) => {
		const from = event.fromLocation
		const to = event.toLocation
		// Hydration, hash-only movement and focus refresh retain initial motion.
		if (
			from &&
			(from.pathname !== to.pathname || from.searchStr !== to.searchStr)
		)
			environment.markSpaNavigation()
	})
	return () => {
		stopHistory()
		stopBefore()
		stopMount()
	}
}

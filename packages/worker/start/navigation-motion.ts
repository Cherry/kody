import { type AnyRouter } from '@tanstack/router-core'
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
	router: Pick<AnyRouter, 'subscribe' | 'update'>,
	environment: MotionEnvironment,
) {
	const stopBefore = router.subscribe('onBeforeNavigate', (event) => {
		const from = event.fromLocation
		router.update({
			defaultViewTransition:
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
		stopBefore()
		stopMount()
	}
}

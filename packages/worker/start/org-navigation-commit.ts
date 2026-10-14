import { type AnyRouter } from '@tanstack/react-router'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'

/** Serialize cookie writes so a slower previous org cannot win a rapid switch. */
export function createOrgNavigationCommit(
	remember: (slug: string) => Promise<{ ok: boolean }>,
	origin: string,
) {
	let pending = Promise.resolve()
	let previousSlug: string | null = null
	return (href: string) => {
		const url = new URL(href, origin)
		const slug = orgSlugFromOrgOwnedPath(url.pathname)
		if (!slug || slug === previousSlug) return pending
		previousSlug = slug
		pending = pending.then(async () => {
			try {
				const response = await remember(slug)
				if (!response.ok && previousSlug === slug) previousSlug = null
			} catch {
				if (previousSlug === slug) previousSlug = null
			}
		})
		return pending
	}
}

export function installOrgNavigationCommit(
	router: Pick<AnyRouter, 'subscribe'> & {
		state: { matches: ReadonlyArray<{ status: string }> }
	},
	remember: (slug: string) => Promise<{ ok: boolean }>,
	origin: string,
) {
	const commit = createOrgNavigationCommit(remember, origin)
	return router.subscribe('onResolved', ({ toLocation }) => {
		if (router.state.matches.some((match) => match.status !== 'success')) return
		void commit(toLocation.href)
	})
}

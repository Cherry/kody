import { type AnyRouter } from '@tanstack/react-router'
import { lastUsedOrgCommitApiPath } from '#universal/org-last-used-cookie.ts'
import { orgSlugFromOrgOwnedPath } from '#universal/org-pages.ts'

/** Serialize cookie writes so a slower previous org cannot win a rapid switch. */
export function createOrgNavigationCommit(
	fetcher: typeof fetch,
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
				const response = await fetcher(lastUsedOrgCommitApiPath, {
					headers: { Accept: 'application/json' },
					credentials: 'include',
					referrer: url.href,
				})
				// Drain the small JSON response before releasing the queued commit.
				// An unread streamed body can keep the browser request open.
				await response.text()
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
	fetcher: typeof fetch,
	origin: string,
) {
	const commit = createOrgNavigationCommit(fetcher, origin)
	return router.subscribe('onResolved', ({ toLocation }) => {
		if (router.state.matches.some((match) => match.status !== 'success')) return
		void commit(toLocation.href)
	})
}

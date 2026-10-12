import { queryOptions, type QueryClient } from '@tanstack/react-query'
import { isPublicDocSlug } from './page-access.ts'
import { loadShell } from '#start/server/shell'

export function shellSearch(search: string) {
	const input = new URLSearchParams(search)
	const output = new URLSearchParams()
	for (const key of ['youtubeId']) {
		const value = input.get(key)
		if (value !== null) output.set(key, value)
	}
	const value = output.toString()
	return value ? `?${value}` : ''
}

export function shellQuery(actorKey: string | null, search: string) {
	const relevantSearch = shellSearch(search)
	return queryOptions({
		queryKey: ['shell', actorKey, relevantSearch] as const,
		queryFn: ({ signal }) =>
			loadShell({ data: { pathname: '/', search: relevantSearch }, signal }),
		staleTime: 60_000,
		gcTime: 5 * 60_000,
	})
}

export async function ensureShellQuery(
	client: QueryClient,
	actorKey: string | null,
	search: string,
) {
	const options = shellQuery(actorKey, search)
	return client.ensureQueryData({ ...options, revalidateIfStale: true })
}

export function invalidateShellQueries(
	client: QueryClient,
	actorKey: string | null,
) {
	return client.invalidateQueries({ queryKey: ['shell', actorKey] })
}

/** Other routes can contain private or actor-specific data even at public URLs. */
export function requiresSessionVerification(pathname: string) {
	if (
		[
			'/',
			'/pricing',
			'/features',
			'/features/memory',
			'/features/secrets',
			'/features/packages',
			'/features/apps',
			'/features/integrations',
			'/features/triggers',
			'/for/business',
			'/use-cases',
			'/use-cases/shared-agent-memory',
			'/use-cases/claude-code-custom-tools',
			'/use-cases/scheduled-workflows',
			'/use-cases/mcp-gateway',
			'/use-cases/ai-workflow-automation',
			'/integrations/claude',
			'/integrations/gmail',
			'/integrations/slack',
			'/compare/n8n-alternatives',
			'/compare/composio-alternatives',
			'/support',
			'/privacy',
			'/terms',
			'/case-studies',
			'/faq',
			'/blog',
			'/docs',
			'/docs/connect',
		].includes(pathname)
	)
		return false
	const doc = /^\/docs\/([^/]+)$/.exec(pathname)
	if (doc) {
		try {
			return !isPublicDocSlug(decodeURIComponent(doc[1]!))
		} catch {
			return true
		}
	}
	return !/^\/blog\/[^/]+$/.test(pathname)
}

import { createPageQuery } from './page-query.ts'
import { loadConnectionUsagePage } from '#start/server/connection-usage'
import { accountConnectionsListHref } from '#universal/account-connections.ts'
const usageQuery = createPageQuery(
	'loadConnectionUsagePage',
	loadConnectionUsagePage,
	{ staleTime: 30_000 },
)
export function connectionUsageQuery(actorKey: string | null, href: string) {
	return usageQuery(
		actorKey,
		accountConnectionsListHref(new URL(href, 'https://kody.local').pathname),
	)
}

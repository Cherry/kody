import { createFileRoute } from '@tanstack/react-router'
import { redirectAccountCredits } from '#start/server/org-navigation'
export const Route = createFileRoute('/account_/credits')({
	validateSearch: (search: Record<string, unknown>) => search,
	beforeLoad: ({ location }) =>
		redirectAccountCredits({ data: location.pathname + location.searchStr }),
})

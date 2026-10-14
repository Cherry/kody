import { createFileRoute } from '@tanstack/react-router'
import { redirectAccountCredits } from '../server/org-navigation.ts'
export const Route = createFileRoute('/account_/credits')({
	validateSearch: (search: Record<string, unknown>) => search,
	beforeLoad: ({ location }) =>
		redirectAccountCredits({ data: location.pathname + location.searchStr }),
})

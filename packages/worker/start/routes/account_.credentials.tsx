import { createFileRoute } from '@tanstack/react-router'
import { redirectCredentialEntry } from '../server/credential-redirect.ts'
export const Route = createFileRoute('/account_/credentials')({
	validateSearch: (search: Record<string, unknown>) => search,
	beforeLoad: ({ location }) =>
		redirectCredentialEntry({ data: location.pathname + location.searchStr }),
})

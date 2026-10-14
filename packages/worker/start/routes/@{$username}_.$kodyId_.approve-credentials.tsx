/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'

import { PackageCredentialApprovalRoute } from '../pages/package-credential-approval.tsx'
import { loadCredentialApprovalPage } from '#start/server/credentials'
import { documentHead } from '../components/document-head.ts'

export const Route = createFileRoute(
	'/@{$username}_/$kodyId_/approve-credentials',
)({
	loaderDeps: ({ search }) => search,
	context: ({ location }) => ({
		pageQueryInput: location.pathname + location.searchStr,
	}),
	preload: false,
	staleTime: 0,
	gcTime: 0,
	loader: ({ context }) =>
		loadCredentialApprovalPage({ data: context.pageQueryInput }),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { pageQueryInput } = Route.useRouteContext()
	const { payload } = Route.useLoaderData()
	return (
		<PackageCredentialApprovalRoute
			key={pageQueryInput}
			payload={payload}
			currentHref={pageQueryInput}
		/>
	)
}

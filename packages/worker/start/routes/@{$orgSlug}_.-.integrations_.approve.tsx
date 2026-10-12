/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { AccountIntegrationsPage } from '../pages/account-integrations.tsx'
import { loadIntegrationsPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/@{$orgSlug}_/-/integrations_/approve')({
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadIntegrationsPage({
			signal: abortController.signal,
			data: location.pathname + location.searchStr,
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { payload } = Route.useLoaderData()
	const location = useLocation()
	return (
		<AccountIntegrationsPage payload={payload} currentHref={location.href} />
	)
}

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AccountSecretProvidersPage } from '../pages/account-secret-providers.tsx'
import { loadSecretProvidersPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute(
	'/@{$orgSlug}_/-/secret-providers_/approve',
)({
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadSecretProvidersPage({
			signal: abortController.signal,
			data: location.pathname + location.searchStr,
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { payload } = Route.useLoaderData()
	const { pageLocation: location } = Route.useRouteContext()
	return (
		<AccountSecretProvidersPage payload={payload} currentHref={location.href} />
	)
}

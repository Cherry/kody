/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { loadConnectOauth } from '#start/server/connect'
import { ConnectOauthRoute } from '../pages/connect-oauth.tsx'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/connect/oauth')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadConnectOauth({
			signal: abortController.signal,
			data: location.pathname + location.searchStr,
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const location = useLocation()
	const href = location.href
	return (
		<ConnectOauthRoute
			key={location.state.__TSR_key ?? location.state.key}
			currentHref={href}
			initialData={Route.useLoaderData().payload}
		/>
	)
}

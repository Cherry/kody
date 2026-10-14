/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadOAuthPage } from '#start/server/oauth'
import { OAuthAuthorizeRoute } from '../pages/oauth-authorize.tsx'

export const Route = createFileRoute('/oauth/authorize')({
	preload: false,
	loaderDeps: ({ search }) => search,
	loader: ({ location }) => loadOAuthPage({ data: location.searchStr }),
	component: Page,
})

function Page() {
	const { pageLocation: location } = Route.useRouteContext()
	return (
		<OAuthAuthorizeRoute key={location.searchStr} {...Route.useLoaderData()} />
	)
}

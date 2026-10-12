/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { LoginPage } from '../pages/login.tsx'
import { loadAuthPage } from '#start/server/auth-page'
export const Route = createFileRoute('/signup')({
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadAuthPage({ signal: abortController.signal, data: location.href }),
	component: AuthPage,
})
function AuthPage() {
	const data = Route.useLoaderData()
	const location = useLocation()
	return (
		<LoginPage
			key={location.href}
			mode="signup"
			currentHref={location.href}
			authConfig={data.authConfig}
			session={data.session}
		/>
	)
}

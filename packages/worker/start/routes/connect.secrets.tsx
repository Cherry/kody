/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { loadConnectSecrets } from '#start/server/connect'
import { ConnectSecretsRoute } from '../pages/connect-secrets.tsx'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/connect/secrets')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadConnectSecrets({
			signal: abortController.signal,
			data: location.pathname + location.searchStr,
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const href = useLocation({ select: (l) => l.href })
	return (
		<ConnectSecretsRoute
			key={href}
			initialData={Route.useLoaderData().payload}
		/>
	)
}

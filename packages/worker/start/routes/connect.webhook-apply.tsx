/** @jsxImportSource @emotion/react */
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { loadConnectWebhookApply } from '#start/server/connect'
import { ConnectWebhookApplyRoute } from '../pages/connect-webhook-apply.tsx'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/connect/webhook-apply')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadConnectWebhookApply({
			signal: abortController.signal,
			data: location.pathname + location.searchStr,
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const href = useLocation({ select: (l) => l.href })
	return (
		<ConnectWebhookApplyRoute
			key={href}
			initialData={Route.useLoaderData().payload}
		/>
	)
}

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadBillingCompletion } from '#start/server/billing-completion'
import { AccountBillingSuccessPage } from '../pages/account-billing-success.tsx'
import { documentHead } from '../components/document-head.ts'

export const Route = createFileRoute('/account_/billing_/success')({
	preload: false,
	staleTime: Infinity,
	shouldReload: false,
	loaderDeps: ({ search }) => search,
	loader: ({ location }) =>
		loadBillingCompletion({ data: location.pathname + location.searchStr }),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	return <AccountBillingSuccessPage data={Route.useLoaderData().payload} />
}

/** @jsxImportSource @emotion/react */
import { secretsInput } from '../secrets-input.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountSecretsPage } from '../pages/account-secrets.tsx'
import { loadSecretsPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/@{$orgSlug}_/-/secrets_/approve')({
	staticData: { orgScope: { section: 'secrets' } },
	loaderDeps: ({ search }) => search,
	loader: ({ params, abortController, location }) =>
		loadSecretsPage({
			signal: abortController.signal,
			data: secretsInput(params.orgSlug, location.searchStr),
		}),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: SecretsPage,
})
function SecretsPage() {
	const { payload } = Route.useLoaderData()
	const { pageLocation: location } = Route.useRouteContext()
	return (
		<AccountSecretsPage
			packageApproval={true}
			payload={payload}
			currentHref={location.href}
			selection={{ selectedId: null, isCreating: false }}
		/>
	)
}

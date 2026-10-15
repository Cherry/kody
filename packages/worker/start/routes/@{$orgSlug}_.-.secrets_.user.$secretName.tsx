/** @jsxImportSource @emotion/react */
import { secretsInput } from '../secrets-input.ts'
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute } from '@tanstack/react-router'
import { AccountSecretsPage } from '../pages/account-secrets.tsx'
import { loadSecretsPage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadSecretsPage', loadSecretsPage, {
	staleTime: 60_000,
})

export const Route = createFileRoute(
	'/@{$orgSlug}_/-/secrets_/user/$secretName',
)({
	staticData: { orgScope: { section: 'secrets' } },
	loaderDeps: ({ search }) => search,
	context: ({ params, location }) => ({
		pageQueryInput: secretsInput(params.orgSlug, location.searchStr, {
			scope: 'user',
			name: params.secretName,
		}),
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: SecretsPage,
})
function SecretsPage() {
	const { payload } = usePageData()
	const { pageLocation: location } = Route.useRouteContext()
	return <AccountSecretsPage payload={payload} currentHref={location.href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

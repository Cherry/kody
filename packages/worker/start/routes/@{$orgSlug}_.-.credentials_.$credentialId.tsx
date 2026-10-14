/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadPageQuery, usePageQuery } from '../page-query.ts'
import { AccountCredentialsRoute } from '../pages/account-credentials.tsx'
import {
	credentialsPageQuery as pageQuery,
	credentialPresentationSearchKeys,
	validateCredentialSearch,
} from '../credentials-query.ts'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute(
	'/@{$orgSlug}_/-/credentials_/$credentialId',
)({
	validateSearch: validateCredentialSearch,
	staticData: { presentationSearchKeys: credentialPresentationSearchKeys },
	shouldReload: ({ context }) => !context.presentationOnly,
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageLocation.pathname),
			preload,
		),

	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: Page,
})
function Page() {
	const { actorKey, pageLocation } = Route.useRouteContext()
	const { payload } = usePageQuery(
		pageQuery(actorKey, pageLocation.pathname),
	).data
	return (
		<AccountCredentialsRoute
			payload={payload}
			currentHref={pageLocation.href}
		/>
	)
}

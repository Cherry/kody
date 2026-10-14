/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AccountEmailPage } from '../pages/account-email.tsx'
import { emailSearch } from '../pages/email-resources.ts'
import {
	loadEmailResources,
	useEmailResources,
} from '../pages/email-resource-queries.ts'

export const Route = createFileRoute('/@{$orgSlug}_/-/email_/$messageId')({
	validateSearch: emailSearch,
	loaderDeps: ({ search }) => ({
		q: search.q,
		classification: search.classification,
		page: search.page,
		pageSize: search.pageSize,
		selected: search.selected,
	}),
	loader: async ({ context }) => {
		await loadEmailResources(
			context.queryClient,
			context.actorKey,
			context.pageLocation.href,
		)
	},
	head: () => ({ meta: [{ title: 'Email inbox' }] }),
	component: Page,
})
function Page() {
	const { actorKey, pageLocation } = Route.useRouteContext()
	const emailHref = pageLocation.href
	const { payload, destinations } = useEmailResources(actorKey, emailHref)
	return (
		<AccountEmailPage
			payload={payload}
			destinations={destinations}
			currentHref={emailHref}
		/>
	)
}

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadActionPage } from '#start/server/action-page'
import { VerifyEmailRoute } from '../pages/verify-email.tsx'

export const Route = createFileRoute('/verify-email-change')({
	preload: false,
	staleTime: Infinity,
	shouldReload: false,
	loaderDeps: ({ search }) => search,
	loader: ({ location }) => loadActionPage({ data: location.href }),
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData?.title ?? 'Kody' }],
	}),
	component: Page,
})
function Page() {
	const data = Route.useLoaderData().loaderData?.emailVerification
	if (!data) throw new Error('Missing action result')
	return <VerifyEmailRoute data={data} />
}

/** @jsxImportSource @emotion/react */
import { rejectActionPageHead } from '../action-page-method.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadActionPage } from '#start/server/action-page'
import { UnsubscribeTipsRoute } from '../pages/unsubscribe-tips.tsx'

export const Route = createFileRoute('/unsubscribe/tips')({
	server: { handlers: { HEAD: rejectActionPageHead } },
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
	const data = Route.useLoaderData().loaderData?.tipsUnsubscribe
	if (!data) throw new Error('Missing action result')
	return <UnsubscribeTipsRoute data={data} />
}

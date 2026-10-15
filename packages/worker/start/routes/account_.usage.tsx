/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery } from '../page-query.ts'
import { rejectActionPageHead } from '../action-page-method.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadUsagePage } from '#start/server/account-collections'
import { documentHead } from '../components/document-head.ts'
const pageQuery = createPageQuery('loadUsagePage', loadUsagePage, {
	staleTime: 10_000,
})

export const Route = createFileRoute('/account_/usage')({
	staticData: {
		motionGroup: 'account',
		navigation: { rail: 'workspace', item: 'usage' },
	},
	server: {
		handlers: {
			HEAD: ({ request, next }) => {
				const search = new URL(request.url).searchParams
				return search.get('topup') === 'success' &&
					search.get('session_id')?.trim()
					? rejectActionPageHead()
					: next()
			},
		},
	},
	loaderDeps: ({ search }) => search,
	context: ({ location }) => {
		const search = new URLSearchParams(location.searchStr)
		return {
			pageQueryInput: {
				credits: search.get('credits'),
				error: search.get('error'),
				topup: search.get('topup'),
				sessionId: search.get('session_id'),
				hash: location.hash,
				navigationSearch: [...search],
			},
		}
	},
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
})

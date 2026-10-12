/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { ProfileRoute, ProfileUnavailable } from '../pages/profile.tsx'
import { documentHead } from '../components/document-head.ts'
import { loadProfile } from '#start/server/public-data'
import { pageSearch } from '../page-search.ts'

const pageQuery = createPageQuery('loadProfile', loadProfile)

export const Route = createFileRoute('/@{$username}')({
	validateSearch: (search: Record<string, unknown>) => search,
	loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
		limit: search.limit,
		q: search.limit != null ? search.q : undefined,
	}),
	context: ({ location, params }) => ({
		pageQueryInput: {
			username: params.username,
			search: pageSearch(
				location.searchStr,
				new URLSearchParams(location.searchStr).has('limit')
					? ['limit', 'q']
					: [],
			),
		},
	}),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) =>
		loaderData
			? documentHead(loaderData.head)
			: { meta: [{ title: 'Profile unavailable' }] },
	component: Profile,
	notFoundComponent: ProfileUnavailable,
})
function Profile() {
	const { data } = usePageData()
	const href = useLocation({ select: (location) => location.href })
	return <ProfileRoute data={data} currentHref={href} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

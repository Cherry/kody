/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { heroBaseImage } from '#universal/landing-images.ts'
import { createFileRoute } from '@tanstack/react-router'
import { loadHome } from '#start/server/home'
import { HomeRoute } from '../pages/home.tsx'
import { documentHead } from '../components/document-head.ts'

const pageQuery = createPageQuery('loadHome', loadHome, { staleTime: 60_000 })

export const Route = createFileRoute('/')({
	context: () => ({ pageQueryInput: undefined }),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => {
		const head = documentHead(loaderData?.head)
		return {
			...head,
			links: [
				...(head.links ?? []),
				{
					rel: 'preload',
					as: 'image',
					type: 'image/webp',
					href: heroBaseImage.src,
					fetchPriority: 'high',
					imageSrcSet: heroBaseImage.srcSet,
					imageSizes: heroBaseImage.sizes,
				},
			],
		}
	},
	component: Home,
})

function Home() {
	const data = usePageData()
	return <HomeRoute {...data} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

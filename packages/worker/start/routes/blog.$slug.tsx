/** @jsxImportSource @emotion/react */
import { loadPageQuery, createPageQuery, usePageQuery } from '../page-query.ts'
import { NotFoundPage } from '../components/not-found-page.tsx'
import { createFileRoute } from '@tanstack/react-router'
import { loadBlogPost } from '#start/server/blog'
import { documentHead } from '../components/document-head.ts'
import { BlogPostRoute } from '../pages/blog-post.tsx'

const pageQuery = createPageQuery('loadBlogPost', loadBlogPost, {
	staleTime: 5 * 60_000,
	gcTime: 30 * 60_000,
})

export const Route = createFileRoute('/blog/$slug')({
	// Blog content is build-backed and does not depend on search parameters.
	context: ({ params }) => ({ pageQueryInput: { slug: params.slug } }),
	loader: ({ context, preload }) =>
		loadPageQuery(
			context.queryClient,
			pageQuery(context.actorKey, context.pageQueryInput),
			preload,
		),
	head: ({ loaderData }) => documentHead(loaderData?.head),
	component: BlogPost,
	notFoundComponent: NotFoundPage,
})
function BlogPost() {
	return <BlogPostRoute post={usePageData()} />
}

function usePageData() {
	const { actorKey, pageQueryInput } = Route.useRouteContext()
	return usePageQuery(pageQuery(actorKey, pageQueryInput)).data
}

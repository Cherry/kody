import { type Action } from 'remix/router'
import { bytesToBase64 } from '@kody-internal/shared/base64.ts'
import { getAppBaseUrl } from '#worker/app-base-url.ts'
import { type routes } from '#universal/routes.ts'
import {
	getBlogPost,
	getReadNextBlogPost,
	listBlogPosts,
	toBlogPostSummary,
} from '#worker/blog/catalog.ts'
import { type BlogPost } from '#worker/blog/parse-frontmatter.ts'
import { buildBlogRssXml } from '#worker/blog/rss.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { markdownResponse } from '#app/markdown-negotiation.ts'
import { parseOgTheme } from '#worker/og/palette.ts'
import { highlightMarkdownFences } from '#app/highlight-code.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'

export function createBlogApiHandler(_env: Env) {
	return {
		middleware: [],
		async handler() {
			return jsonResponse({
				ok: true,
				posts: listBlogPosts().map(toBlogPostSummary),
			})
		},
	} satisfies Action<typeof routes.blogApi>
}

export async function toBlogPostLoaderData(
	env: Env,
	post: BlogPost,
	serverTiming?: Array<ServerTimingEntry>,
) {
	return {
		ok: true as const,
		slug: post.slug,
		title: post.title,
		date: post.date,
		description: post.description,
		placeholder: post.placeholder,
		image: post.image,
		imageAlt: post.imageAlt,
		ogImage: post.ogImage,
		body: post.body,
		bodyFences: await highlightMarkdownFences(env, post.body, { serverTiming }),
		readNext: getReadNextBlogPost(post.slug),
	}
}

export function createBlogPostApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ params }) {
			const post = getBlogPost(params.slug)
			if (!post) {
				return jsonResponse({ ok: false, error: 'Blog post not found.' }, 404)
			}

			const serverTiming: Array<ServerTimingEntry> = []
			return jsonResponse(await toBlogPostLoaderData(env, post, serverTiming), {
				serverTiming,
			})
		},
	} satisfies Action<typeof routes.blogPostApi>
}

export function createBlogPostMarkdownHandler(_env: Env) {
	return {
		middleware: [],
		async handler({ params }) {
			const post = getBlogPost(params.slug)
			if (!post) {
				return markdownResponse('# Blog post not found\n', 404)
			}
			return markdownResponse(post.body)
		},
	} satisfies Action<typeof routes.blogPostMarkdown>
}

/**
 * Resolve a Satori-safe PNG/JPEG data URI for optional blog artwork.
 * Only `ogImage` is composed into the card. Headline `image` stays on
 * the post. WebP and AVIF are skipped because Satori cannot embed them.
 */
async function loadBlogOgArtworkDataUri(input: {
	env: Env
	request: Request
	post: BlogPost
}): Promise<string | null> {
	const artworkPath = input.post.ogImage
	const assets = input.env.ASSETS
	if (!artworkPath || !assets) return null

	const imageResponse = await assets.fetch(
		new Request(new URL(artworkPath, input.request.url)),
	)
	if (!imageResponse.ok) return null

	const contentType = imageResponse.headers.get('content-type') ?? ''
	if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
		return null
	}

	return `data:${contentType};base64,${bytesToBase64(
		new Uint8Array(await imageResponse.arrayBuffer()),
	)}`
}

export function createBlogPostOgImageHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const post = getBlogPost(params.slug)
			if (!post) {
				return new Response('Not found', { status: 404 })
			}

			// `?theme=light` renders the pale variant; anything unrecognised
			// falls back to the default rather than erroring.
			const theme = parseOgTheme(new URL(request.url).searchParams.get('theme'))

			// Lazy import (sanctioned exception to the no-inline-imports rule):
			// the OG renderer pulls in satori and @resvg/resvg-wasm plus two wasm
			// binaries, which would otherwise bloat isolate cold starts for a
			// route that is only hit by social-media crawlers.
			const { renderBlogPostOgImage } = await import('#worker/blog/og-image.ts')
			const imageDataUri = await loadBlogOgArtworkDataUri({
				env,
				request,
				post,
			})
			const png = await renderBlogPostOgImage({
				title: post.title,
				description: post.description,
				date: post.date,
				theme,
				assets: env.ASSETS,
				...(imageDataUri ? { imageDataUri } : {}),
			})

			return new Response(png, {
				status: 200,
				headers: {
					'Cache-Control': 'public, max-age=3600',
					'Content-Type': 'image/png',
				},
			})
		},
	} satisfies Action<typeof routes.blogPostOgImage>
}

export function createBlogRssHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const origin = getAppBaseUrl({ env, requestUrl: request.url })
			const xml = buildBlogRssXml({
				origin,
				posts: listBlogPosts(),
			})

			return new Response(xml, {
				status: 200,
				headers: {
					'Cache-Control': 'public, max-age=300',
					'Content-Type': 'application/rss+xml; charset=utf-8',
				},
			})
		},
	} satisfies Action<typeof routes.blogRss>
}

import { personalOrgId } from '@kody-internal/shared/owner-person-ids.ts'
import { jsonResponse as buildJsonResponse } from '#worker/json-response.ts'
import { z } from 'zod'
import { type Action } from 'remix/router'
import { toPublicCommunityListing } from '#app/community-public.ts'
import {
	loadCommunityDetailPayload,
	loadCommunityPackagePayload,
} from '#app/community-package-payload.ts'
import { REMIX_FRAME_TARGET_HEADER } from '#universal/frame-constants.ts'
import { type routes } from '#universal/routes.ts'
import { getRequestDataCacheLookup } from '#app/request-cache.ts'
import { anonymousPersonalizedJsonCacheHeaders } from '#app/anonymous-html-cache.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { bytesToBase64 } from '@kody-internal/shared/base64.ts'
import { CommunityActionError } from '#worker/community/errors.ts'
import {
	getCommunityIconObject,
	renderCommunityIconFallbackPng,
} from '#worker/community/community-icon.ts'
import { convertIconRasterToPng } from '#worker/community/icon-fit.ts'
import {
	getCommunityListingWithAggregates,
	reportCommunityListing,
} from '#worker/community/service.ts'
import { type CommunityListingRecord } from '#worker/community/types.ts'
import { parseOgTheme } from '#worker/og/palette.ts'
import { collectServerTiming } from '#worker/request-context.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'

const reportReasonSchema = z
	.string()
	.trim()
	.min(1, 'Report reason is required.')
	.max(2000, 'Report reason must be at most 2000 characters.')

export function redirectToCanonicalPath(input: {
	path: string
	url: URL
	cache?: 'public' | 'private'
}) {
	const destination = new URL(input.path, input.url)
	destination.search = input.url.search
	const cache = input.cache ?? 'public'
	if (cache === 'private') {
		return new Response(null, {
			status: 302,
			headers: {
				location: destination.toString(),
				'cache-control': 'private, no-store',
				vary: `${REMIX_FRAME_TARGET_HEADER}, Cookie`,
			},
		})
	}
	return new Response(null, {
		status: 301,
		headers: {
			location: destination.toString(),
			'cache-control': 'public, max-age=3600',
			vary: REMIX_FRAME_TARGET_HEADER,
		},
	})
}

export {
	highlightReadmeFences,
	readmeForPackagePage,
} from '#app/community-package-payload.ts'

export function createCommunityDetailApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const result = await loadCommunityDetailPayload(
				env,
				request,
				params.listingId,
			)
			if (result.kind === 'not_found')
				return jsonResponse(
					request,
					{ ok: false, error: 'Catalog entry not found.' },
					404,
				)
			return jsonResponse(
				request,
				result.data,
				200,
				result.serverTiming,
				anonymousPersonalizedJsonCacheHeaders({
					personalized: result.data.loggedIn,
					request,
					visibilityGated: true,
				}),
			)
		},
	} satisfies Action<typeof routes.communityDetailApi>
}
export function createCommunityPackageApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const result = await loadCommunityPackagePayload({
				env,
				request,
				username: params.username,
				kodyId: params.kodyId,
			})
			if (result.kind === 'redirect')
				return jsonResponse(
					request,
					{ ok: false, error: 'Public package moved.', redirectTo: result.to },
					404,
				)
			if (result.kind === 'not_found')
				return jsonResponse(
					request,
					{ ok: false, error: 'Catalog entry not found.' },
					404,
				)
			if (result.kind === 'unauthorized')
				return jsonResponse(request, { ok: false, error: 'Unauthorized.' }, 401)
			return jsonResponse(
				request,
				result.data,
				200,
				result.serverTiming,
				anonymousPersonalizedJsonCacheHeaders({
					personalized: result.data.loggedIn,
					request,
					visibilityGated: true,
				}),
			)
		},
	} satisfies Action<typeof routes.communityPackageApi>
}

/**
 * Resolve a satori-safe data URI for the package community icon. PNG and JPEG
 * bytes embed directly; WebP is converted to PNG through Images because satori
 * cannot decode it. Load failures fall back to the generated mark.
 */
async function loadCommunityOgIconDataUri(input: {
	env: Env
	listing: CommunityListingRecord
}): Promise<string> {
	try {
		const { descriptor, object } = await getCommunityIconObject({
			env: input.env,
			listing: input.listing,
			iconCommit: input.listing.iconCommit,
		})
		const bytes = new Uint8Array(await object.arrayBuffer())
		if (
			descriptor.contentType === 'image/png' ||
			descriptor.contentType === 'image/jpeg'
		) {
			return `data:${descriptor.contentType};base64,${bytesToBase64(bytes)}`
		}
		if (descriptor.contentType === 'image/webp') {
			const png = await convertIconRasterToPng({
				images: input.env.IMAGES,
				bytes,
			})
			return `data:image/png;base64,${bytesToBase64(png)}`
		}
	} catch (error) {
		console.error('community-og-icon-load-failed', input.listing.id, error)
	}

	const fallback = await renderCommunityIconFallbackPng(input.listing.name)
	return `data:image/png;base64,${bytesToBase64(fallback)}`
}

export function createCommunityDetailOgImageHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const listingId = params.listingId
			const listing = await getCommunityListingWithAggregates({
				env,
				listingId,
				includeDelisted: false,
			})
			if (!listing) {
				return new Response('Not found', { status: 404 })
			}

			const publicListing = toPublicCommunityListing(listing)
			const iconDataUri = await loadCommunityOgIconDataUri({ env, listing })
			// `?theme=light` renders the pale variant; anything unrecognised
			// falls back to the default rather than erroring.
			const theme = parseOgTheme(new URL(request.url).searchParams.get('theme'))

			// Lazy import (sanctioned exception to the no-inline-imports rule):
			// the OG renderer pulls in satori and @resvg/resvg-wasm plus two wasm
			// binaries, which would otherwise bloat isolate cold starts for a
			// route that is only hit by social-media crawlers.
			const { renderCommunityOgImage } =
				await import('#worker/community/og-image.ts')
			const png = await renderCommunityOgImage({
				name: publicListing.name,
				description: publicListing.description,
				ownerUsername: publicListing.ownerUsername,
				averageStars: publicListing.averageStars,
				ratingCount: publicListing.ratingCount,
				forkCount: publicListing.forkCount,
				iconDataUri,
				theme,
				assets: env.ASSETS,
			})

			return new Response(png, {
				status: 200,
				headers: {
					'Cache-Control': 'public, max-age=3600',
					'Content-Type': 'image/png',
				},
			})
		},
	} satisfies Action<typeof routes.communityDetailOgImage>
}

export function createCommunityReportApiPostHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			if (request.method !== 'POST') {
				return jsonResponse(
					request,
					{ ok: false, error: 'Method not allowed.' },
					405,
				)
			}

			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse(request, { ok: false, error: 'Unauthorized.' }, 401)
			}

			const body = await request.json().catch(() => null)
			if (!body || typeof body !== 'object') {
				return jsonResponse(
					request,
					{ ok: false, error: 'Invalid request body.' },
					400,
				)
			}

			const parsedReason = reportReasonSchema.safeParse(
				(body as Record<string, unknown>).reason,
			)
			if (!parsedReason.success) {
				return jsonResponse(
					request,
					{
						ok: false,
						error:
							parsedReason.error.issues[0]?.message ?? 'Invalid report reason.',
					},
					400,
				)
			}

			try {
				await reportCommunityListing({
					env,
					userId: personalOrgId(user.mcpUser.userId),
					listingId: params.listingId,
					reason: parsedReason.data,
				})
				return jsonResponse(request, { ok: true })
			} catch (error) {
				if (error instanceof CommunityActionError) {
					return jsonResponse(request, { ok: false, error: error.message }, 400)
				}
				console.error('Community report submission failed:', error)
				return jsonResponse(
					request,
					{ ok: false, error: 'Unable to submit report.' },
					500,
				)
			}
		},
	} satisfies Action<typeof routes.communityReportApiPost>
}

function jsonResponse(
	request: Request,
	body: Record<string, unknown>,
	status = 200,
	serverTiming?: Array<ServerTimingEntry>,
	cacheHeaders?: HeadersInit,
) {
	const cacheLookup = getRequestDataCacheLookup(request)
	const headers = new Headers(cacheHeaders)
	if (cacheLookup) headers.set('X-Kody-Cache', cacheLookup)
	return buildJsonResponse(body, {
		status,
		headers,
		serverTiming: collectServerTiming(request, serverTiming),
	})
}

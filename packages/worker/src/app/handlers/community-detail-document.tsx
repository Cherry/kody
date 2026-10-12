import { type Action } from 'remix/router'
import { loadCommunityDetailData } from '#app/community-data.ts'
import { loadPackagePage, packagePageIsPrivate } from '#app/package-page.ts'
import {
	loadPackagePageHasAgentsDocs,
	resolvePackagePageReadmeImageBaseHref,
} from '#app/package-files-data.ts'
import { resolveCanonicalListingPath } from '#app/community-package-route.ts'
import { handleFrameRequest } from '#app/frame-registry.ts'
import '#app/frame-registrations.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import { recordServerTiming } from '#worker/request-context.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'
import {
	redirectToCanonicalPath,
	highlightReadmeFences,
	readmeForPackagePage,
} from './community-detail.tsx'

async function renderCommunityListingPage(input: {
	request: Request
	env: Env
	listingId: string | null
}) {
	const detail = input.listingId
		? await loadCommunityDetailData(input.env, input.request, input.listingId)
		: null
	if (!input.listingId || !detail?.listing) {
		return renderPackageNotFoundPage(input)
	}

	const serverTiming: Array<ServerTimingEntry> = []
	const [readmeFences, hasAgentsDocs, imageBaseHref] = await Promise.all([
		highlightReadmeFences(
			input.env,
			detail.listing.readmeContent,
			serverTiming,
		),
		recordServerTiming(
			'agents-docs',
			() =>
				loadPackagePageHasAgentsDocs({
					env: input.env,
					request: input.request,
					listingId: input.listingId,
					ownerSourceId: detail.ownerPackage?.sourceId,
					viewerIsOwner: detail.viewerIsOwner,
				}),
			input.request,
		),
		resolvePackagePageReadmeImageBaseHref({
			listingId: input.listingId,
			ownerUsername: detail.username,
			kodyId: detail.listing.kodyId,
			usedListingReadme: true,
		}),
	])

	return renderAppPage({
		request: input.request,
		env: input.env,
		serverTiming,
		loaderData: {
			communityDetailShell: {
				ok: true,
				listingId: input.listingId,
				defaultBranch: detail.listing.defaultBranch ?? null,
				name: detail.listing.name,
				description: detail.listing.description,
				ownerProfilePublic: detail.ownerProfilePublic,
				forkPrompt: detail.forkPrompt,
				loggedIn: detail.loggedIn,
				viewerIsAdmin: detail.viewerIsAdmin,
				trusted: detail.listing.trusted,
				featured: detail.listing.featured,
				readmeContent: detail.listing.readmeContent,
				readmeFences,
				hasAgentsDocs,
				imageBaseHref,
				viewerInstall: detail.viewerInstall,
				ownerPackage: detail.ownerPackage,
				username: detail.username,
				kodyId: detail.listing.kodyId,
				viewerIsOwner: detail.viewerIsOwner,
				viewerCanManage: detail.viewerCanManage,
				isPrivate: false,
				invocationUrlOrigin: detail.invocationUrlOrigin,
			},
		},
	})
}

function renderPackageNotFoundPage(input: { request: Request; env: Env }) {
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: 'Not found',
		notFound: true,
		status: 404,
	})
}

function renderPackageUnauthorizedPage(input: { request: Request; env: Env }) {
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: 'Unauthorized',
		unauthorized: true,
		status: 401,
	})
}

/**
 * The listing-uuid URL predates the canonical `/@owner/kody-id` one and stays
 * addressable for every link already shared. Documents move to the canonical
 * URL; the JSON companion and the frame do not, so the client keeps working
 * for a visitor who is already on this path.
 */
export function createCommunityDetailHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const listingId = params.listingId
			const url = new URL(request.url)
			const frameResponse = await handleFrameRequest(request, env, url.pathname)
			if (frameResponse) return frameResponse

			const detail = await loadCommunityDetailData(env, request, listingId)
			const listing = detail?.listing
			const canonicalPath = listing
				? await resolveCanonicalListingPath({
						env,
						listingId,
						ownerUsername: listing.ownerUsername,
						kodyId: listing.kodyId,
					})
				: null
			// A listing whose canonical pair no longer resolves stays served here
			// rather than redirecting permanently at a dead URL.
			if (canonicalPath) {
				return redirectToCanonicalPath({ path: canonicalPath, url })
			}

			return renderCommunityListingPage({ request, env, listingId })
		},
	} satisfies Action<typeof routes.communityDetail>
}

export function createCommunityPackageHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const url = new URL(request.url)
			const frameResponse = await handleFrameRequest(request, env, url.pathname)
			if (frameResponse) return frameResponse

			const page = await loadPackagePage({
				env,
				request,
				username: params.username,
				kodyId: params.kodyId,
			})
			if (page.kind === 'redirect') {
				return redirectToCanonicalPath({
					path: page.to,
					url,
					cache: page.shared ? 'public' : 'private',
				})
			}
			if (page.kind === 'not_found') {
				return renderPackageNotFoundPage({ request, env })
			}
			if (page.kind === 'unauthorized') {
				return renderPackageUnauthorizedPage({ request, env })
			}

			if (page.listing?.listing) {
				const serverTiming: Array<ServerTimingEntry> = []
				const [readme, hasAgentsDocs, imageBaseHref] = await Promise.all([
					readmeForPackagePage(
						{
							env,
							request,
							listingReadme: page.listing.listing.readmeContent,
							ownerSourceId: page.ownerPackage?.sourceId,
							viewerIsOwner: page.viewerIsOwner,
							ownerUserId: page.ownerUserId,
						},
						serverTiming,
					),
					recordServerTiming(
						'agents-docs',
						() =>
							loadPackagePageHasAgentsDocs({
								env,
								request,
								listingId: page.listing?.listing?.id,
								ownerSourceId: page.ownerPackage?.sourceId,
								viewerIsOwner: page.viewerIsOwner,
								ownerUserId: page.ownerUserId,
							}),
						request,
					),
					resolvePackagePageReadmeImageBaseHref({
						listingId: page.listing.listing.id,
						ownerUsername: page.username,
						kodyId: page.kodyId,
						usedListingReadme: Boolean(page.listing.listing.readmeContent),
						publishedCommit: page.ownerPackage?.publishedCommit,
						pinnedCommit: page.listing.listing.pinnedCommit,
					}),
				])
				return renderAppPage({
					request,
					env,
					serverTiming,
					loaderData: {
						communityDetailShell: {
							ok: true,
							listingId: page.listing.listing.id,
							defaultBranch: page.listing.listing.defaultBranch ?? null,
							name: page.listing.listing.name,
							description: page.listing.listing.description,
							ownerProfilePublic: page.ownerProfilePublic,
							forkPrompt: page.listing.forkPrompt,
							loggedIn: page.listing.loggedIn,
							viewerIsAdmin: page.listing.viewerIsAdmin,
							trusted: page.listing.listing.trusted,
							featured: page.listing.listing.featured,
							readmeContent: readme.readmeContent,
							readmeFences: readme.readmeFences,
							hasAgentsDocs,
							imageBaseHref,
							viewerInstall: page.listing.viewerInstall,
							ownerPackage: page.ownerPackage,
							username: page.username,
							kodyId: page.kodyId,
							viewerIsOwner: page.viewerIsOwner,
							viewerCanManage: page.viewerCanManage,
							viewerCanPublish: page.viewerCanPublish,
							viewerCanDelete: page.viewerCanDelete,
							viewerCanAdoptCommunityFork: page.viewerCanAdoptCommunityFork,
							isPrivate: packagePageIsPrivate(page),
							invocationUrlOrigin: page.invocationUrlOrigin,
						},
					},
				})
			}

			if (!page.ownerPackage) {
				return renderPackageNotFoundPage({ request, env })
			}

			const serverTiming: Array<ServerTimingEntry> = []
			const [readme, hasAgentsDocs, imageBaseHref] = await Promise.all([
				readmeForPackagePage(
					{
						env,
						request,
						listingReadme: null,
						ownerSourceId: page.ownerPackage?.sourceId,
						viewerIsOwner: page.viewerIsOwner,
						ownerUserId: page.ownerUserId,
					},
					serverTiming,
				),
				recordServerTiming(
					'agents-docs',
					() =>
						loadPackagePageHasAgentsDocs({
							env,
							request,
							listingId: null,
							ownerSourceId: page.ownerPackage?.sourceId,
							viewerIsOwner: page.viewerIsOwner,
							ownerUserId: page.ownerUserId,
						}),
					request,
				),
				resolvePackagePageReadmeImageBaseHref({
					ownerUsername: page.username,
					kodyId: page.kodyId,
					usedListingReadme: false,
					publishedCommit: page.ownerPackage?.publishedCommit,
				}),
			])
			return renderAppPage({
				request,
				env,
				title: page.ownerPackage?.name ?? `@${page.username}/${page.kodyId}`,
				serverTiming,
				loaderData: {
					communityDetailShell: {
						ok: true,
						listingId: null,
						defaultBranch: null,
						name: page.ownerPackage?.name ?? `@${page.username}/${page.kodyId}`,
						description: page.ownerPackage?.description ?? '',
						ownerProfilePublic: page.ownerProfilePublic,
						forkPrompt: '',
						loggedIn: page.loggedIn,
						viewerIsAdmin: false,
						trusted: false,
						featured: false,
						readmeContent: readme.readmeContent,
						readmeFences: readme.readmeFences,
						hasAgentsDocs,
						imageBaseHref,
						viewerInstall: null,
						ownerPackage: page.ownerPackage,
						username: page.username,
						kodyId: page.kodyId,
						viewerIsOwner: page.viewerIsOwner,
						viewerCanManage: page.viewerCanManage,
						viewerCanPublish: page.viewerCanPublish,
						viewerCanDelete: page.viewerCanDelete,
						viewerCanAdoptCommunityFork: page.viewerCanAdoptCommunityFork,
						isPrivate: packagePageIsPrivate(page),
						invocationUrlOrigin: page.invocationUrlOrigin,
					},
				},
			})
		},
	} satisfies Action<typeof routes.communityPackage>
}

export function createCommunityPackageSettingsHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const page = await loadPackagePage({
				env,
				request,
				username: params.username,
				kodyId: params.kodyId,
			})
			if (page.kind === 'redirect') {
				return redirectToCanonicalPath({
					path: `${page.to}/settings`,
					url: new URL(request.url),
					cache: page.shared ? 'public' : 'private',
				})
			}
			if (page.kind === 'not_found') {
				return renderPackageNotFoundPage({ request, env })
			}
			if (page.kind === 'unauthorized') {
				return renderPackageUnauthorizedPage({ request, env })
			}
			if (!page.viewerCanManage || !page.ownerPackage) {
				return renderPackageNotFoundPage({ request, env })
			}

			return renderAppPage({
				request,
				env,
				title: `${page.ownerPackage.name} settings`,
				loaderData: {
					communityDetailShell: {
						ok: true,
						listingId: page.listing?.listing?.id ?? null,
						defaultBranch: page.listing?.listing?.defaultBranch ?? null,
						name: page.ownerPackage.name,
						description: page.ownerPackage.description,
						ownerProfilePublic: page.ownerProfilePublic,
						forkPrompt: '',
						loggedIn: page.loggedIn,
						viewerIsAdmin: false,
						trusted: false,
						featured: false,
						readmeContent: null,
						hasAgentsDocs: false,
						imageBaseHref: null,
						viewerInstall: null,
						ownerPackage: page.ownerPackage,
						username: page.username,
						kodyId: page.kodyId,
						viewerIsOwner: true,
						viewerCanManage: true,
						viewerCanPublish: page.viewerCanPublish,
						viewerCanDelete: page.viewerCanDelete,
						viewerCanAdoptCommunityFork: page.viewerCanAdoptCommunityFork,
						isPrivate: page.ownerPackage.isPrivate,
						invocationUrlOrigin: page.invocationUrlOrigin,
					},
				},
			})
		},
	} satisfies Action<typeof routes.communityPackageSettings>
}

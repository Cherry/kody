import { type Action } from 'remix/router'
import { getOwnerUsernameFromListingName } from '#worker/community/public-urls.ts'
import { getCommunityListingById } from '#worker/community/repo.ts'
import { getSavedPackageById } from '#worker/package-registry/repo.ts'
import {
	resolveCanonicalFilesPath,
	resolveCommunityFilesRoute,
} from '#app/community-package-route.ts'
import {
	loadAccessiblePackageFilesData,
	loadCommunityPackageFilesData,
} from '#app/package-files-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import {
	getPackageTreeHref,
	normalizePackageFilesPath,
} from '#universal/package-files.ts'
import { type routes } from '#universal/routes.ts'
import { recordServerTiming } from '#worker/request-context.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'
import { redirectToCanonicalPath } from './package-files.ts'

function renderFilesNotFound(input: {
	request: Request
	env: Env
	serverTiming?: Array<ServerTimingEntry>
}) {
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: 'Package files not found',
		notFound: true,
		status: 404,
		serverTiming: input.serverTiming,
	})
}

function renderFilesUnauthorized(input: { request: Request; env: Env }) {
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: 'Unauthorized',
		unauthorized: true,
		status: 401,
	})
}

async function renderListingFilesPage(input: {
	request: Request
	env: Env
	listingId: string | null
	selectedPath: string
	ref?: string
}) {
	const serverTiming: Array<ServerTimingEntry> = []
	const data = input.listingId
		? await loadCommunityPackageFilesData({
				env: input.env,
				request: input.request,
				listingId: input.listingId,
				selectedPath: input.selectedPath,
				ref: input.ref,
				serverTiming,
			})
		: null
	if (!data) {
		return renderFilesNotFound({
			request: input.request,
			env: input.env,
			serverTiming,
		})
	}
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: `${data.title} files`,
		loaderData: { packageFiles: data },
		serverTiming,
	})
}

async function renderPackageFilesPage(input: {
	request: Request
	env: Env
	username: string
	kodyId: string
	selectedPath: string
	ref?: string
}) {
	const serverTiming: Array<ServerTimingEntry> = []
	const data = await loadAccessiblePackageFilesData({
		env: input.env,
		request: input.request,
		username: input.username,
		kodyId: input.kodyId,
		selectedPath: input.selectedPath,
		ref: input.ref,
		serverTiming,
	})
	if (!data) {
		return renderFilesNotFound({
			request: input.request,
			env: input.env,
			serverTiming,
		})
	}
	return renderAppPage({
		request: input.request,
		env: input.env,
		title: `${data.title} files`,
		loaderData: { packageFiles: data },
		serverTiming,
	})
}

async function renderResolvedFilesPage(input: {
	request: Request
	env: Env
	url: URL
}) {
	const target = await recordServerTiming(
		'files-route',
		() =>
			resolveCommunityFilesRoute({
				env: input.env,
				url: input.url,
				request: input.request,
			}),
		input.request,
	)
	if (target?.kind === 'invalid-path' || !target) {
		return renderFilesNotFound({ request: input.request, env: input.env })
	}
	if (target.kind === 'unauthorized') {
		return renderFilesUnauthorized({ request: input.request, env: input.env })
	}
	if (target.kind === 'redirect') {
		return redirectToCanonicalPath({
			path: target.to,
			url: input.url,
			cache: target.shared ? 'public' : 'private',
		})
	}
	if (target.kind === 'package') {
		return renderPackageFilesPage({
			request: input.request,
			env: input.env,
			username: target.username,
			kodyId: target.kodyId,
			selectedPath: target.selectedPath,
			ref: target.ref,
		})
	}
	return renderListingFilesPage({
		request: input.request,
		env: input.env,
		listingId: target.listingId,
		selectedPath: target.selectedPath,
		ref: target.ref,
	})
}

export function createCommunityPackageFilesHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			return renderResolvedFilesPage({
				request,
				env,
				url: new URL(request.url),
			})
		},
	} satisfies Action<typeof routes.communityPackageFiles>
}

export function createCommunityPackageTreeHandler(env: Env) {
	return createCommunityPackageFilesHandler(env) as unknown as Action<
		typeof routes.communityPackageTree
	>
}

export function createCommunityDetailFilesHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const url = new URL(request.url)
			const target = await recordServerTiming(
				'files-route',
				() => resolveCommunityFilesRoute({ env, url, request }),
				request,
			)
			if (target?.kind === 'invalid-path' || !target) {
				return renderFilesNotFound({ request, env })
			}
			if (target.kind === 'unauthorized') {
				return renderFilesUnauthorized({ request, env })
			}
			if (target.kind === 'redirect') {
				return redirectToCanonicalPath({
					path: target.to,
					url,
					cache: target.shared ? 'public' : 'private',
				})
			}
			if (target.kind === 'package') {
				return renderPackageFilesPage({
					request,
					env,
					username: target.username,
					kodyId: target.kodyId,
					selectedPath: target.selectedPath,
					ref: target.ref,
				})
			}

			const listing = await getCommunityListingById(env.APP_DB, {
				listingId: target.listingId,
				includeDelisted: false,
			})
			const ownerUsername = listing
				? getOwnerUsernameFromListingName(listing.name)
				: null
			const canonicalPath =
				listing && ownerUsername
					? await resolveCanonicalFilesPath({
							env,
							listingId: listing.id,
							ownerUsername,
							kodyId: listing.kodyId,
							selectedPath: target.selectedPath,
							ref: target.ref,
						})
					: null
			if (canonicalPath && canonicalPath !== url.pathname) {
				return redirectToCanonicalPath({ path: canonicalPath, url })
			}

			return renderListingFilesPage({
				request,
				env,
				listingId: target.listingId,
				selectedPath: target.selectedPath,
				ref: target.ref,
			})
		},
	} satisfies Action<typeof routes.communityDetailFiles>
}

export function createAccountPackageFilesHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) return user

			const selectedPath = normalizePackageFilesPath(
				typeof params.relativePath === 'string' ? params.relativePath : '',
			)
			if (selectedPath == null) {
				return renderFilesNotFound({ request, env })
			}

			const record = await getSavedPackageById(env.APP_DB, {
				userId: user.mcpUser.userId,
				packageId: params.packageId,
			})
			if (!record) {
				return renderFilesNotFound({ request, env })
			}
			return redirectToCanonicalPath({
				path: getPackageTreeHref({
					username: user.username,
					kodyId: record.kodyId,
					relativePath: selectedPath,
				}),
				url: new URL(request.url),
				cache: 'private',
			})
		},
	} satisfies Action<typeof routes.accountPackageFiles>
}

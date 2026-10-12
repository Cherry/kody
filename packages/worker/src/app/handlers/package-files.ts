// remix-skill: HTML + JSON /files controllers. Pages SSR the explorer;
// JSON companions use `?path=`. Public and private packages share this
// path; visibility is enforced by loadPackagePage.
import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { getSavedPackageById } from '#worker/package-registry/repo.ts'
import { treeHrefFromPackageHome } from '#app/community-package-route.ts'
import { loadPackagePage } from '#app/package-page.ts'
import {
	loadAccessiblePackageFilesData,
	loadCommunityPackageFilesData,
	readPackageFilesSelectedPath,
} from '#app/package-files-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { anonymousPersonalizedJsonCacheHeaders } from '#app/anonymous-html-cache.ts'
import { getPackageTreeHref } from '#universal/package-files.ts'
import { type routes } from '#universal/routes.ts'
import { collectServerTiming } from '#worker/request-context.ts'
import { type ServerTimingEntry } from '#worker/server-timing.ts'

export function redirectToCanonicalPath(input: {
	path: string
	url: URL
	cache?: 'public' | 'private'
}) {
	const destination = new URL(input.path, input.url)
	destination.search = input.url.search
	if (input.cache === 'private') {
		return new Response(null, {
			status: 302,
			headers: {
				location: destination.toString(),
				'cache-control': 'private, no-store',
			},
		})
	}
	return new Response(null, {
		status: 301,
		headers: {
			location: destination.toString(),
			'cache-control': 'public, max-age=3600',
		},
	})
}

export function createCommunityPackageFilesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const url = new URL(request.url)
			const selectedPath = readPackageFilesSelectedPath(request.url)
			if (selectedPath == null) {
				return jsonResponse(
					{ ok: false, error: 'Package file path was invalid.' },
					400,
				)
			}
			const treeRef = url.searchParams.get('ref')?.trim() || ''
			const page = await loadPackagePage({
				env,
				request,
				username: params.username,
				kodyId: params.kodyId,
			})
			if (page.kind === 'redirect') {
				return jsonResponse(
					{
						ok: false,
						error: 'Package moved.',
						redirectTo: treeHrefFromPackageHome(page.to, {
							relativePath: selectedPath,
							ref: treeRef,
						}),
					},
					404,
				)
			}
			if (page.kind === 'unauthorized') {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}
			if (page.kind !== 'page') {
				return jsonResponse(
					{ ok: false, error: 'Package files not found.' },
					404,
				)
			}
			const serverTiming: Array<ServerTimingEntry> = []
			const data = await loadAccessiblePackageFilesData({
				env,
				request,
				username: page.username,
				kodyId: page.kodyId,
				selectedPath,
				ref: treeRef,
				serverTiming,
			})
			if (!data) {
				return jsonResponse(
					{ ok: false, error: 'Package files not found.' },
					404,
				)
			}
			// The file tree is viewer-independent; a session cookie alone makes
			// the response private so an owner's tree never lands in a shared cache.
			return jsonResponse(data, {
				headers: anonymousPersonalizedJsonCacheHeaders({
					personalized: false,
					request,
					visibilityGated: true,
				}),
				serverTiming: collectServerTiming(request, serverTiming),
			})
		},
	} satisfies Action<typeof routes.communityPackageFilesApi>
}

export function createCommunityDetailFilesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const selectedPath = readPackageFilesSelectedPath(request.url)
			if (selectedPath == null) {
				return jsonResponse(
					{ ok: false, error: 'Package file path was invalid.' },
					400,
				)
			}
			const treeRef = new URL(request.url).searchParams.get('ref')?.trim() || ''
			const serverTiming: Array<ServerTimingEntry> = []
			const data = await loadCommunityPackageFilesData({
				env,
				request,
				listingId: params.listingId,
				selectedPath,
				ref: treeRef,
				serverTiming,
			})
			if (!data) {
				return jsonResponse(
					{ ok: false, error: 'Public package files not found.' },
					404,
				)
			}
			// The file tree is viewer-independent; a session cookie alone makes
			// the response private so an owner's tree never lands in a shared cache.
			return jsonResponse(data, {
				headers: anonymousPersonalizedJsonCacheHeaders({
					personalized: false,
					request,
					visibilityGated: true,
				}),
				serverTiming: collectServerTiming(request, serverTiming),
			})
		},
	} satisfies Action<typeof routes.communityDetailFilesApi>
}

export function createAccountPackageFilesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}
			if (request.method !== 'GET') {
				return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
			}
			const selectedPath = readPackageFilesSelectedPath(request.url)
			if (selectedPath == null) {
				return jsonResponse(
					{ ok: false, error: 'Package file path was invalid.' },
					400,
				)
			}
			const record = await getSavedPackageById(env.APP_DB, {
				userId: user.mcpUser.userId,
				packageId: params.packageId,
			})
			if (!record) {
				return jsonResponse(
					{ ok: false, error: 'Package files not found.' },
					404,
				)
			}
			return jsonResponse(
				{
					ok: false,
					error: 'Package files moved.',
					redirectTo: getPackageTreeHref({
						username: user.username,
						kodyId: record.kodyId,
						relativePath: selectedPath,
					}),
				},
				404,
			)
		},
	} satisfies Action<typeof routes.accountPackageFilesApi>
}

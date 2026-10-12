import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { createMatcher } from 'remix/route-pattern/match'
import { routes } from '#universal/routes.ts'
import {
	normalizePackageFilesPath,
	buildPackageFilesApiHref,
} from '#universal/package-files.ts'
import { type PackageFilesLoaderData } from '#universal/loader-data.ts'

export const loadPackageFiles = createServerFn({ method: 'GET' })
	.validator((data: { pathname: string }) => {
		if (
			!data ||
			typeof data.pathname !== 'string' ||
			!data.pathname.startsWith('/') ||
			data.pathname.startsWith('//')
		)
			throw notFound()
		return { pathname: data.pathname }
	})
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getEnv },
			{ getRequest },
			{ setAuthSessionSecret },
			handlers,
			{ RequestContext },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/package-files.ts'),
			import('remix/router'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const original = getRequest()
		const url = new URL(data.pathname, original.url)
		function requestFor(apiHref: string, path: string, ref?: string) {
			const apiUrl = new URL(
				buildPackageFilesApiHref(apiHref, path),
				original.url,
			)
			if (ref) apiUrl.searchParams.set('ref', ref)
			return new Request(apiUrl, { headers: original.headers })
		}
		let response: Response
		const tree = createMatcher(routes.communityPackageTree.pattern).match(url)
		const community = createMatcher(routes.communityPackageFiles.pattern).match(
			url,
		)
		const listing = createMatcher(routes.communityDetailFiles.pattern).match(
			url,
		)
		const account = createMatcher(routes.accountPackageFiles.pattern).match(url)
		if (tree || community) {
			const match = tree ?? community!
			const path = normalizePackageFilesPath(match.params.relativePath ?? '')
			if (path == null) throw notFound()
			const context = new RequestContext<{ username: string; kodyId: string }>(
				requestFor(
					routes.communityPackageFilesApi.href(match.params),
					path,
					tree?.params.ref,
				),
			)
			context.params = {
				username: match.params.username,
				kodyId: match.params.kodyId,
			}
			response = await handlers
				.createCommunityPackageFilesApiHandler(bindings)
				.handler(context)
		} else if (listing) {
			const path = normalizePackageFilesPath(listing.params.relativePath ?? '')
			if (path == null) throw notFound()
			const context = new RequestContext<{ listingId: string }>(
				requestFor(routes.communityDetailFilesApi.href(listing.params), path),
			)
			context.params = { listingId: listing.params.listingId }
			response = await handlers
				.createCommunityDetailFilesApiHandler(bindings)
				.handler(context)
		} else if (account) {
			const path = normalizePackageFilesPath(account.params.relativePath ?? '')
			if (path == null) throw notFound()
			const context = new RequestContext<{ packageId: string }>(
				requestFor(routes.accountPackageFilesApi.href(account.params), path),
			)
			context.params = { packageId: account.params.packageId }
			response = await handlers
				.createAccountPackageFilesApiHandler(bindings)
				.handler(context)
		} else throw notFound()
		if (response.status === 401) throw redirect({ href: '/login' })
		const payload = (await response.json()) as PackageFilesLoaderData & {
			redirectTo?: string
		}
		if (response.status === 404) {
			if (payload.redirectTo) throw redirect({ href: payload.redirectTo })
			throw notFound()
		}
		if (!response.ok || !payload.ok)
			throw new Error('Unable to load package files.')
		return {
			data: payload,
			head: loadDocumentHead(data.pathname, { packageFiles: payload }),
		}
	})

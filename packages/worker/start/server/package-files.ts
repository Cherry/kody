import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { createMatcher } from 'remix/route-pattern/match'
import { routes } from '#universal/routes.ts'
import {
	normalizePackageFilesPath,
	getPackageTreeHref,
} from '#universal/package-files.ts'

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
			{ getRequest, setResponseHeader },
			{ setAuthSessionSecret },
			{ resolveCommunityFilesRoute },
			{ loadAccessiblePackageFilesData, loadCommunityPackageFilesData },
			{ requireAuthenticatedPageUser },
			{ getSavedPackageByIdInAnyOrg },
			{ viewerCanReadSavedPackage },
			{ loadOrgBindingForOrg },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/community-package-route.ts'),
			import('../../src/app/package-files-data.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/package-registry/repo.ts'),
			import('../../src/app/package-viewer-access.ts'),
			import('../../src/orgs/repo.ts'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const original = getRequest()
		const url = new URL(data.pathname, original.url)
		const account = createMatcher(routes.accountPackageFiles.pattern).match(url)
		if (!account) {
			const request = new Request(url, { headers: original.headers })
			const target = await resolveCommunityFilesRoute({
				env: bindings,
				url,
				request,
			})
			if (!target || target.kind === 'invalid-path') throw notFound()
			if (target.kind === 'unauthorized') throw redirect({ href: '/login' })
			if (target.kind === 'redirect') {
				const destination = new URL(target.to, url)
				destination.search = url.search
				setResponseHeader(
					'Cache-Control',
					target.shared ? 'public, max-age=3600' : 'private, no-store',
				)
				throw redirect({
					href: destination.toString(),
					statusCode: target.shared ? 301 : 302,
				})
			}
			const payload =
				target.kind === 'package'
					? await loadAccessiblePackageFilesData({
							env: bindings,
							request,
							username: target.username,
							kodyId: target.kodyId,
							selectedPath: target.selectedPath,
							ref: target.ref,
						})
					: await loadCommunityPackageFilesData({
							env: bindings,
							request,
							listingId: target.listingId,
							selectedPath: target.selectedPath,
							ref: target.ref,
						})
			if (!payload) throw notFound()
			return {
				data: payload,
				head: loadDocumentHead(data.pathname, { packageFiles: payload }),
			}
		}
		const path = normalizePackageFilesPath(account.params.relativePath ?? '')
		if (path == null) throw notFound()
		const request = new Request(url, { headers: original.headers })
		const user = await requireAuthenticatedPageUser(request, bindings)
		if (user instanceof Response) {
			const cookie = user.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			throw redirect({
				href: user.headers.get('Location') ?? '/login',
				statusCode: user.status,
			})
		}
		const saved = await getSavedPackageByIdInAnyOrg(
			bindings.APP_DB,
			account.params.packageId,
		)
		if (
			!saved ||
			!(await viewerCanReadSavedPackage({
				env: bindings,
				viewer: user.mcpUser,
				ownerId: saved.userId,
				packageId: saved.id,
			}))
		)
			throw notFound()
		const binding = await loadOrgBindingForOrg(
			bindings.APP_DB,
			user.mcpUser.userId,
			saved.userId,
		)
		setResponseHeader('Cache-Control', 'private, no-store')
		throw redirect({
			href: getPackageTreeHref({
				username: binding?.org.slug ?? user.username,
				kodyId: saved.kodyId,
				relativePath: path,
			}),
			statusCode: 302,
		})
	})

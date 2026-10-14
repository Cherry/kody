import { type PackageCredentialsLoaderData } from '#universal/package-credentials-page.ts'
import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { accountAliasPath } from '#universal/org-pages.ts'
import { type AccountCredentialsResponse } from '#universal/credentials-list.ts'

export const loadCredentialsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!href.startsWith('/') ||
			href.startsWith('//') ||
			href.includes('\\') ||
			!/^\/account\/credentials(?:\/[^/]+)?$/.test(
				accountAliasPath(new URL(href, 'https://kody.local').pathname),
			)
		)
			throw new Error('Invalid credentials URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ loadCollection },
			{ loadAccountCredentialsData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./account-collections'),
			import('../../src/app/account-credentials-data'),
			import('./document-head'),
		])
		const { bindings, user, request } = await loadCollection(href)
		const url = new URL(request.url)
		const segment = accountAliasPath(url.pathname).split('/')[3]
		const payload: AccountCredentialsResponse =
			await loadAccountCredentialsData({
				env: bindings,
				user,
				selectedId:
					segment && segment !== 'new' ? decodeURIComponent(segment) : null,
			})
		return {
			payload,
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

export const loadCredentialApprovalPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/@[^/]+\/[^/]+\/approve-credentials(?:\?[^#]*)?$/.test(href) ||
			href.includes('\\')
		)
			throw new Error('Invalid approval URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ loadCollection },
			{ resolveCredentialApproval },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./account-collections'),
			import('../../src/credentials/credential-approval'),
			import('./document-head'),
		])
		const { bindings, request, user } = await loadCollection(href)
		const url = new URL(request.url)
		const parts = url.pathname.split('/')
		const { loadPackagePage } = await import('../../src/app/package-page')
		const page = await loadPackagePage({
			env: bindings,
			request,
			username: decodeURIComponent(parts[1]!.slice(1)),
			kodyId: decodeURIComponent(parts[2]!),
		})
		if (page.kind === 'redirect')
			throw redirect({
				href: `${page.to}/approve-credentials${url.search}`,
				statusCode: 302,
			})
		const { loadPackageMappingScopeForViewer } =
			await import('../../src/app/package-credentials-access.ts')
		const { parseCredentialApprovalQuery } =
			await import('../../universal/credential-contracts.ts')
		const scope = await loadPackageMappingScopeForViewer({
			env: bindings,
			request,
			user,
			username: decodeURIComponent(parts[1]!.slice(1)),
			kodyId: decodeURIComponent(parts[2]!),
		})
		if (!scope) throw notFound()
		const { view } = await resolveCredentialApproval(
			scope,
			parseCredentialApprovalQuery(url.searchParams),
		)
		return {
			payload: { ok: true as const, view },
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

export const loadPackageCredentialsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/@[^/]+\/[^/]+\/(credentials|mappings|triggers)(?:\?[^#]*)?$/.test(
				href,
			) ||
			href.includes('\\')
		)
			throw new Error('Invalid package credentials URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ loadCollection },
			{ loadPackagePage, packagePageIsPrivate },
			{ buildPackageCredentialsView },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./account-collections'),
			import('../../src/app/package-page'),
			import('../../src/credentials/package-credential-mappings'),
			import('./document-head'),
		])
		const { bindings, request, user } = await loadCollection(href)
		const url = new URL(request.url)
		const parts = url.pathname.split('/')
		const params = {
			username: decodeURIComponent(parts[1]!.slice(1)),
			kodyId: decodeURIComponent(parts[2]!),
		}
		const page = await loadPackagePage({ env: bindings, request, ...params })
		if (page.kind === 'no_access') {
			const { packageNoAccessResult } = await import('./package-no-access.ts')
			return { ...packageNoAccessResult(page, url.pathname), payload: null }
		}
		const { loadPackageMappingScopeForViewer } =
			await import('../../src/app/package-credentials-access.ts')
		const scope = await loadPackageMappingScopeForViewer({
			env: bindings,
			request,
			user,
			...params,
		})
		if (page.kind === 'redirect')
			throw redirect({
				href: `${page.to}/${parts[3]}${url.search}`,
				statusCode: 302,
			})
		if (page.kind !== 'page' || !page.ownerPackage || !page.viewerIsOwner)
			throw notFound()
		const view = scope ? await buildPackageCredentialsView(scope) : null
		const payload: PackageCredentialsLoaderData = {
			ok: true,
			shell: {
				username: page.username,
				kodyId: page.kodyId,
				name: page.ownerPackage.name,
				description: page.ownerPackage.description ?? '',
				isPrivate: packagePageIsPrivate(page),
				isListed: page.ownerPackage.hasCommunityListing === true,
				listingId: page.listing?.listing?.id ?? null,
				defaultBranch: page.listing?.listing?.defaultBranch ?? null,
				publishedCommit: page.ownerPackage.publishedCommit ?? null,
				ownerProfilePublic: page.ownerProfilePublic,
				viewerCanManage: page.viewerCanManage,
				viewerCanManageAccess: page.viewerCanManageAccess,
			},
			view,
			viewError: view
				? null
				: 'You can read this package but not run it, so it has no credentials, mappings, or triggers for you. Ask an org owner for run access.',
		}
		return {
			kind: 'page' as const,
			payload,
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { accountAliasPath } from '#universal/org-pages.ts'
import { type AccountCredentialsResponse } from '#universal/credentials-list.ts'
import { type CredentialApprovalView } from '#universal/credential-contracts.ts'

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
			{ createPackageCredentialApprovalApiHandler },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./account-collections'),
			import('../../src/app/handlers/package-credential-approval'),
			import('./document-head'),
		])
		const { bindings, request } = await loadCollection(href)
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
		const response = await createPackageCredentialApprovalApiHandler(
			bindings,
		).handler({
			request,
			url,
			params: {
				username: decodeURIComponent(parts[1]!.slice(1)),
				kodyId: decodeURIComponent(parts[2]!),
			},
		})
		if (response.status === 401)
			throw redirect({ href: `/login?redirectTo=${encodeURIComponent(href)}` })
		if (response.status === 404) throw notFound()
		if (!response.ok) throw new Error('Unable to load credential approval')
		const view = (await response.json()) as CredentialApprovalView
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
			{ createPackageCredentialsApiHandler },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./account-collections'),
			import('../../src/app/package-page'),
			import('../../src/app/handlers/package-credentials'),
			import('./document-head'),
		])
		const { bindings, request } = await loadCollection(href)
		const url = new URL(request.url)
		const parts = url.pathname.split('/')
		const params = {
			username: decodeURIComponent(parts[1]!.slice(1)),
			kodyId: decodeURIComponent(parts[2]!),
		}
		const [page, response] = await Promise.all([
			loadPackagePage({ env: bindings, request, ...params }),
			createPackageCredentialsApiHandler(bindings).handler({
				request,
				url,
				params,
			}),
		])
		if (page.kind === 'redirect')
			throw redirect({
				href: `${page.to}/${parts[3]}${url.search}`,
				statusCode: 302,
			})
		if (page.kind !== 'page' || !page.ownerPackage || !page.viewerIsOwner)
			throw notFound()
		if (response.status === 401)
			throw redirect({ href: `/login?redirectTo=${encodeURIComponent(href)}` })
		const body = (await response.json()) as
			| import('#universal/credential-contracts.ts').PackageCredentialsView
			| { ok: false; error?: string }
		const view = response.ok && body.ok ? body : null
		const payload: import('#universal/package-credentials-page.ts').PackageCredentialsLoaderData =
			{
				ok: true,
				shell: {
					username: page.username,
					kodyId: page.kodyId,
					name: page.ownerPackage.name,
					description: page.ownerPackage.description ?? '',
					isPrivate: packagePageIsPrivate(page),
					isListed: Boolean(page.listing),
					listingId: page.listing?.listing.id ?? null,
					defaultBranch: page.listing?.listing.defaultBranch ?? null,
					publishedCommit: page.ownerPackage.publishedCommit ?? null,
					ownerProfilePublic: page.ownerProfilePublic,
					viewerCanManage: page.viewerCanManage,
				},
				view,
				viewError: view
					? null
					: response.status === 404
						? 'You can read this package but not run it, so it has no credentials, mappings, or triggers for you. Ask an org owner for run access.'
						: !body.ok && body.error
							? body.error
							: 'Unable to load package credentials.',
			}
		return {
			payload,
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

import { z } from 'zod'
import { routes } from '#universal/routes.ts'
import { accountAliasPath, parseOrgResourcePath } from '#universal/org-pages.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'
import { notFound, redirect } from '@tanstack/react-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { readJsonRecord } from './json-value.ts'
import { isOrgDocumentRequest } from './org-document-request.ts'

function collectionAliasHref(href: string) {
	if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\'))
		return ''
	const url = new URL(href, 'https://kody.local')
	return accountAliasPath(url.pathname) + url.search + url.hash
}
function validateValuesHref(href: string) {
	if (
		typeof href !== 'string' ||
		!/^\/account\/values(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
			collectionAliasHref(href),
		)
	)
		throw new Error('Invalid account collection URL')
	return href
}
export const loadCollection = createServerOnlyFn(async (href: string) => {
	const [
		{ env },
		{ getRequest, setResponseHeader },
		{ getEnv },
		{ setAuthSessionSecret },
		{ requireAuthenticatedPageUser },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('@tanstack/react-start/server'),
		import('../../src/app/env.ts'),
		import('../../src/app/auth-session.ts'),
		import('../../src/app/page-auth.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const original = getRequest()
	const request = new Request(new URL(href, original.url), {
		headers: original.headers,
	})
	let user = await requireAuthenticatedPageUser(original, bindings, {
		redirectTo: href,
	})
	if (user instanceof Response) {
		const cookie = user.headers.get('Set-Cookie')
		if (cookie) setResponseHeader('Set-Cookie', cookie)
		throw redirect({
			href: user.headers.get('Location') ?? '/login',
			statusCode: user.status,
		})
	}
	const orgPath = parseOrgResourcePath(new URL(href, original.url).pathname)
	if (orgPath) {
		const [{ loadOrgBindingForSlug }, { deriveRequestContext }] =
			await Promise.all([
				import('#worker/orgs/repo.ts'),
				import('#worker/request-context/request-context.ts'),
			])
		const binding = await loadOrgBindingForSlug(
			bindings.APP_DB,
			user.mcpUser.userId,
			orgPath.slug,
		)
		const { orgSectionDenial } = await import('#app/org-request-binding.ts')
		if (!binding || orgSectionDenial(binding, orgPath.section)) throw notFound()
		user = {
			...user,
			request: deriveRequestContext({
				user: user.mcpUser,
				source: { kind: 'session' },
				orgBinding: binding,
			}),
		}
	}
	if (orgPath) {
		const [{ serializeLastUsedOrgCookie }, { isSecureRequest }] =
			await Promise.all([
				import('#universal/org-last-used-cookie.ts'),
				import('../../src/app/auth-session.ts'),
			])
		if (isOrgDocumentRequest()) {
			setResponseHeader(
				'Set-Cookie',
				serializeLastUsedOrgCookie({
					slug: orgPath.slug,
					secure: isSecureRequest(request),
				}),
			)
		}
	}
	setResponseHeader('Cache-Control', 'no-store')
	return { bindings, request, user }
})
export const loadSecretsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/secrets(?:\/(?:new|approve|user\/[^/?#]+|(?:session|package)\/[^/?#]+\/[^/?#]+))?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid secrets URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const setupUrl = new URL(href, 'https://kody.local')
		if (
			accountAliasPath(setupUrl.pathname) === '/account/secrets/new' &&
			setupUrl.searchParams.get('name')?.trim()
		)
			throw redirect({
				href: `/connect/secret-set${setupUrl.search}`,
				statusCode: 302,
			})

		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountSecretsData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-secrets-data.ts'),
				import('./document-head.ts'),
			])
		const payload = await loadAccountSecretsData({
			env: bindings,
			request,
			user,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgSecrets',
				url.pathname,
				{ accountSecrets: payload },
				url.search,
			),
		}
	})

export const loadMemoriesPage = createServerFn({ method: 'GET' })
	.validator(
		z.object({
			orgSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/),
			memoryId: z.string().trim().min(1).optional(),
			selected: z.string().trim().min(1).optional(),
			query: z.string().default(''),
			includeDeleted: z.boolean().default(false),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ loadScopedCollection },
			{ loadAccountMemoriesData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./collection-context.ts'),
			import('../../src/app/account-memories-data.ts'),
			import('./document-head.ts'),
		])
		const pathname =
			routes.orgMemories.href({ orgSlug: data.orgSlug }) +
			(data.memoryId ? `/${encodeURIComponent(data.memoryId)}` : '')
		const params = new URLSearchParams()
		if (data.selected) params.set('selected', data.selected)
		if (data.query) params.set('q', data.query)
		if (data.includeDeleted) params.set('includeDeleted', 'true')
		const search = params.size ? `?${params}` : ''
		const { bindings, user } = await loadScopedCollection({
			orgSlug: data.orgSlug,
			section: 'memories',
			returnTo: pathname + search,
		})
		const payload = await loadAccountMemoriesData({
			env: bindings,
			user,
			query: data.query,
			includeDeleted: data.includeDeleted,
			selectedMemoryId: data.memoryId ?? data.selected ?? null,
		})
		return {
			payload,
			head: loadDocumentHead(
				'orgMemories',
				pathname,
				{ accountMemories: payload },
				search,
			),
		}
	})
export const loadValuesPage = createServerFn({ method: 'GET' })
	.validator(validateValuesHref)
	.handler(async ({ data: href }) => {
		if (
			!accountAliasPath(
				new URL(href, 'https://kody.local').pathname,
			).startsWith('/account/values')
		)
			throw new Error('Invalid values URL')
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountValuesData }, { loadDocumentHead }] = await Promise.all(
			[
				import('../../src/app/account-values-data.ts'),
				import('./document-head.ts'),
			],
		)
		const payload = await loadAccountValuesData({
			env: bindings,
			user,
			url: request.url,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgValues',
				url.pathname,
				{ accountValues: payload },
				url.search,
			),
		}
	})

export const loadJobsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/jobs(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid jobs URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountJobsData }, { loadDocumentHead }] = await Promise.all([
			import('../../src/app/account-jobs-data.ts'),
			import('./document-head.ts'),
		])
		const url = new URL(request.url)
		const data = await loadAccountJobsData({
			env: bindings,
			request,
			user,
			pathJobId: accountAliasPath(url.pathname).split('/')[3]
				? decodeURIComponent(accountAliasPath(url.pathname).split('/')[3]!)
				: undefined,
		})
		const payload = {
			...data,
			selectedJob: data.selectedJob
				? {
						...data.selectedJob,
						params: data.selectedJob.params
							? readJsonRecord(data.selectedJob.params)
							: null,
					}
				: null,
		}
		return {
			payload,
			head: loadDocumentHead(
				'orgJobs',
				url.pathname,
				{ accountJobs: payload },
				url.search,
			),
		}
	})

export const loadWorkflowsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/workflows(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid workflows URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountWorkflowsData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-workflows-data.ts'),
				import('./document-head.ts'),
			])
		const url = new URL(request.url)
		const payload = await loadAccountWorkflowsData({
			env: bindings,
			request,
			user,
			pathWorkflowId: accountAliasPath(url.pathname).split('/')[3]
				? decodeURIComponent(accountAliasPath(url.pathname).split('/')[3]!)
				: undefined,
		})
		return {
			payload,
			head: loadDocumentHead(
				'orgWorkflows',
				url.pathname,
				{ accountWorkflows: payload },
				url.search,
			),
		}
	})

export const loadWaitingPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/waiting(?:\?[^#]*)?$/.test(collectionAliasHref(href))
		)
			throw new Error('Invalid waiting URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountWaitingData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-waiting-data.ts'),
				import('./document-head.ts'),
			])
		const url = new URL(request.url)
		const payload = await loadAccountWaitingData({
			env: bindings,
			user,
			waitUntil: (await import('cloudflare:workers')).waitUntil,
		})
		return {
			payload,
			head: loadDocumentHead(
				'orgWaiting',
				url.pathname,
				{ accountWaiting: payload },
				url.search,
			),
		}
	})

export const loadExperimentsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/experiments(?:\?[^#]*)?$/.test(collectionAliasHref(href))
		)
			throw new Error('Invalid experiments URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountExperimentsData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-experiments-data.ts'),
				import('./document-head.ts'),
			])
		const url = new URL(request.url)
		const payload = await loadAccountExperimentsData({
			db: bindings.APP_DB,
			userId: user.userId,
		})
		return {
			payload,
			head: loadDocumentHead(
				'accountExperiments',
				url.pathname,
				{ accountExperiments: payload },
				url.search,
			),
		}
	})

export const loadActivityPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/activity(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid activity URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountActivityData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-activity-data.ts'),
				import('./document-head.ts'),
			])
		const url = new URL(request.url)
		const data = await loadAccountActivityData({
			env: bindings,
			request,
			user,
			pathRunId: accountAliasPath(url.pathname).split('/')[3]
				? decodeURIComponent(accountAliasPath(url.pathname).split('/')[3]!)
				: undefined,
		})
		const payload = {
			...data,
			selectedRun: data.selectedRun
				? {
						...data.selectedRun,
						metadata: readJsonRecord(data.selectedRun.metadata),
						logs: data.selectedRun.logs.map((log) => ({
							...log,
							fields: log.fields ? readJsonRecord(log.fields) : null,
						})),
					}
				: null,
		}

		return {
			payload,
			head: loadDocumentHead(
				'orgActivity',
				url.pathname,
				{ accountActivity: payload },
				url.search,
			),
		}
	})

export const loadBillingPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/@[^/?#]+\/-\/billing(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid billing URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [
			{ loadOrgBillingPageData, resolveOrgBillingAccess },
			{ loadDocumentHead },
		] = await Promise.all([
			import('../../src/app/handlers/org-billing.ts'),
			import('./document-head.ts'),
		])
		const url = new URL(request.url)
		const access = await resolveOrgBillingAccess({
			request,
			env: bindings,
			user,
			permission: 'billing:read',
		})
		if (!access.ok) throw new Response(access.error, { status: access.status })
		const payload = await loadOrgBillingPageData({
			request,
			env: bindings,
			user,
			org: access.org,
		})
		return {
			payload,
			head: loadDocumentHead(
				'orgBilling',
				url.pathname,
				{ accountBilling: payload },
				url.search,
			),
		}
	})

export const loadUsagePage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/(?:account\/usage|@[^/?#]+\/-\/usage)(?:\?[^#]*)?(?:#[^#]*)?$/.test(
				href,
			)
		)
			throw new Error('Invalid usage URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		if (new URL(request.url).pathname === '/account/usage') {
			const { personalUsageSlug } =
				await import('../../src/app/handlers/account-usage.ts')
			const { personalOrgUsageRedirectUrl } =
				await import('../../src/app/handlers/org-usage.ts')
			const target = new URL(
				personalOrgUsageRedirectUrl({
					requestUrl: request.url,
					slug: await personalUsageSlug(bindings, user),
				}),
			)
			target.hash = new URL(href, request.url).hash
			throw redirect({
				href: target.pathname + target.search + target.hash,
				statusCode: 302,
			})
		}
		const [{ loadOrgUsagePageResult }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/handlers/org-usage.ts'),
				import('./document-head.ts'),
			])
		const payload = await loadOrgUsagePageResult(bindings, request, user)
		if (payload instanceof Response) {
			const location = payload.headers.get('Location')
			if (location)
				throw redirect({ href: location, statusCode: payload.status })
			if (payload.status === 404) throw notFound()
			throw payload
		}
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgUsage',
				url.pathname,
				{ accountUsage: payload },
				url.search,
			),
		}
	})

export const loadConnectionsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/agents(?:\/(?:usage|new(?:\/[^/?#]+)?))?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const { parseAccountConnectionsPathname } =
			await import('../../universal/account-connections.ts')
		if (
			!parseAccountConnectionsPathname(
				accountAliasPath(new URL(request.url).pathname),
			)
		) {
			const { notFound } = await import('@tanstack/react-router')
			throw notFound()
		}

		const [{ loadAccountConnectedAgentsData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/handlers/account-connected-agents.ts'),
				import('./document-head.ts'),
			])
		const payload = await loadAccountConnectedAgentsData({
			env: bindings,
			requestUrl: request.url,
			user,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgAgents',
				url.pathname,
				{ accountConnectedAgents: payload },
				url.search,
			),
		}
	})

export const loadMcpOauthClientsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/mcp-oauth-clients(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)

		const [{ loadClientsPayload }, { loadDocumentHead }] = await Promise.all([
			import('../../src/app/handlers/account-mcp-oauth-clients.ts'),
			import('./document-head.ts'),
		])
		const payload = await loadClientsPayload(bindings.APP_DB, user.userId)
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'accountMcpOauthClients',
				url.pathname,
				{ accountMcpOauthClients: payload },
				url.search,
			),
		}
	})

export const loadWebhooksPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/webhooks(?:\?[^#]*)?$/.test(collectionAliasHref(href))
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)

		const [{ loadAccountWebhooksData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/package-webhooks-data.ts'),
				import('./document-head.ts'),
			])
		const payload = await loadAccountWebhooksData({
			env: bindings,
			requestUrl: request.url,
			user,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgWebhooks',
				url.pathname,
				{ accountWebhooks: payload },
				url.search,
			),
		}
	})

export const loadSecretProvidersPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/secret-providers(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountSecretProvidersData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/account-secret-providers-data.ts'),
				import('./document-head.ts'),
			])
		const payload = await loadAccountSecretProvidersData({
			env: bindings,
			userId: ownerIdFromCaller({ request: user.request, user: user.mcpUser }),
			email: user.email,
			url: request.url,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgSecretProviders',
				url.pathname,
				{ accountSecretProviders: payload },
				url.search,
			),
		}
	})

export const loadMcpServersPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/mcp-servers(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [{ loadAccountMcpServersData }, { loadDocumentHead }, { waitUntil }] =
			await Promise.all([
				import('../../src/app/account-mcp-servers-data.ts'),
				import('./document-head.ts'),
				import('cloudflare:workers'),
			])
		const payload = await loadAccountMcpServersData({
			env: bindings,
			user,
			requestUrl: request.url,
			waitUntil,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgMcpServers',
				url.pathname,
				{ accountMcpServers: payload },
				url.search,
			),
		}
	})

export const loadIntegrationsPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/integrations(?:\/(?:apps\/[^/?#]+|[^/?#]+))?(?:\?[^#]*)?$/.test(
				collectionAliasHref(href),
			)
		)
			throw new Error('Invalid account URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { bindings, request, user } = await loadCollection(href)
		const [
			{ loadAccountIntegrationsData },
			{ loadDocumentHead },
			{ waitUntil },
		] = await Promise.all([
			import('../../src/app/account-integrations-data.ts'),
			import('./document-head.ts'),
			import('cloudflare:workers'),
		])
		const payload = await loadAccountIntegrationsData(bindings, user, {
			waitUntil,
			searchParams: new URL(request.url).searchParams,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				'orgIntegrations',
				url.pathname,
				{ accountIntegrations: payload },
				url.search,
			),
		}
	})

export const loadPackagesIndexPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/account\/packages(?:\?[^#]*)?$/.test(collectionAliasHref(href))
		)
			throw new Error('Invalid packages URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const { request, user } = await loadCollection(href)
		const { routes } = await import('../../universal/routes.ts')
		throw redirect({
			href:
				routes.profile.href({ username: user.username }) +
				new URL(request.url).search,
			statusCode: 302,
		})
	})

import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
function validateHref(href: string) {
	if (
		typeof href !== 'string' ||
		!/^\/connect\/(oauth|secrets|webhook-apply)(?:\?[^#]*)?$/.test(href)
	)
		throw new Error('Invalid connection URL.')
	return href
}
async function context(href: string) {
	const [
		{ env },
		{ getRequest, setResponseHeader },
		{ getEnv },
		{ setAuthSessionSecret },
		{ requireAuthenticatedPageUser },
		{ loadDocumentHead },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('@tanstack/react-start/server'),
		import('../../src/app/env.ts'),
		import('../../src/app/auth-session.ts'),
		import('../../src/app/page-auth.ts'),
		import('./document-head.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const original = getRequest()
	const request = new Request(new URL(href, original.url), {
		headers: original.headers,
	})
	const user = await requireAuthenticatedPageUser(original, bindings, {
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
	return { bindings, request, user, loadDocumentHead }
}
export const loadConnectSecrets = createServerFn({ method: 'GET' })
	.validator(validateHref)
	.handler(async ({ data: href }) => {
		const { bindings, request, user, loadDocumentHead } = await context(href)
		const { loadAccountSecretsData } =
			await import('../../src/app/account-secrets-data.ts')
		const payload = await loadAccountSecretsData({
			env: bindings,
			request,
			user,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				url.pathname,
				{ accountSecrets: payload },
				url.search,
			),
		}
	})
export const loadConnectWebhookApply = createServerFn({ method: 'GET' })
	.validator(validateHref)
	.handler(async ({ data: href }) => {
		const { bindings, request, user, loadDocumentHead } = await context(href)
		const { loadConnectWebhookApplyData } =
			await import('../../src/app/connect-webhook-apply-data.ts')
		const payload = await loadConnectWebhookApplyData({
			env: bindings,
			user,
			requestUrl: request.url,
		})
		const url = new URL(request.url)
		return {
			payload,
			head: loadDocumentHead(
				url.pathname,
				{ connectWebhookApply: payload },
				url.search,
			),
		}
	})
export const loadConnectOauth = createServerFn({ method: 'GET' })
	.validator(validateHref)
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ requirePageSession },
			{ loadDocumentHead },
			{ loadConnectOauthLoaderData },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('./document-head.ts'),
			import('../../src/app/handlers/connect-oauth.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const request = new Request(new URL(href, getRequest().url), {
			headers: getRequest().headers,
		})
		const blocked = await requirePageSession(request)
		if (blocked) {
			const cookie = blocked.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			throw redirect({
				href: blocked.headers.get('Location') ?? '/login',
				statusCode: blocked.status,
			})
		}
		const [{ loadResolvedRequestAuth }, { isOrgRequestDenied }] =
			await Promise.all([
				import('../../src/app/request-auth-cache.ts'),
				import('../../src/app/org-request-binding.ts'),
			])
		const { user } = await loadResolvedRequestAuth(request, env)
		if (user && (await isOrgRequestDenied(request, env, user.mcpUser.userId)))
			throw notFound()
		const url = new URL(request.url),
			payload = await loadConnectOauthLoaderData(bindings, request, url)
		return {
			payload,
			head: loadDocumentHead(
				url.pathname,
				{ connectOauth: payload },
				url.search,
			),
		}
	})

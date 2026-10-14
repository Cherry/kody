import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
function validateHref(href: string) {
	if (
		typeof href !== 'string' ||
		!/^\/connect\/(oauth|secrets|webhook-apply)(?:\?[^#]*)?$/.test(href)
	)
		throw new Error('Invalid connection URL.')
	return href
}
async function context(href: string) {
	const { withWebsiteRead, WebsiteAuthenticationError } =
		await import('./mutation-context.ts')
	const { loadDocumentHead } = await import('./document-head.ts')
	const url = new URL(href, 'https://kody.test')
	const orgSlug = url.searchParams.get('org') ?? undefined
	try {
		return await withWebsiteRead(
			{ scope: orgSlug ? { orgSlug } : undefined },
			async ({ env: bindings, request, user }) => ({
				bindings,
				request,
				user,
				url: new URL(href, request.url),
				loadDocumentHead,
			}),
		)
	} catch (error) {
		if (error instanceof WebsiteAuthenticationError)
			throw redirect({
				href: `/login?redirectTo=${encodeURIComponent(href)}`,
				statusCode: 302,
			})
		throw error
	}
}
export const loadConnectSecrets = createServerFn({ method: 'GET' })
	.validator(validateHref)
	.handler(async ({ data: href }) => {
		const { bindings, request, user, url, loadDocumentHead } =
			await context(href)
		const { loadAccountSecretsData } =
			await import('../../src/app/account-secrets-data.ts')
		const payload = await loadAccountSecretsData({
			env: bindings,
			request,
			search: url.search,
			user,
		})
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
		const { bindings, user, url, loadDocumentHead } = await context(href)
		const { loadConnectWebhookApplyData } =
			await import('../../src/app/connect-webhook-apply-data.ts')
		const payload = await loadConnectWebhookApplyData({
			env: bindings,
			user,
			requestUrl: url.toString(),
		})
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
		const { bindings, request, user, url, loadDocumentHead } =
			await context(href)
		const { loadConnectOauthLoaderData } =
			await import('../../src/app/handlers/connect-oauth.ts')
		const payload = await loadConnectOauthLoaderData(
			bindings,
			request,
			url,
			user,
		)
		return {
			payload,
			head: loadDocumentHead(
				url.pathname,
				{ connectOauth: payload },
				url.search,
			),
		}
	})

export const decideWebhookApply = createServerFn({ method: 'POST' })
	.validator(
		(input: {
			handle: string
			fingerprint: string
			action: 'approve' | 'reject'
		}) => {
			if (
				!input ||
				typeof input.handle !== 'string' ||
				!input.handle.trim() ||
				typeof input.fingerprint !== 'string' ||
				!input.fingerprint.trim() ||
				!['approve', 'reject'].includes(input.action)
			)
				throw new Error('Invalid approval request.')
			return input
		},
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({}, async ({ env, user }) => {
			const { approveConnectWebhookApply, rejectConnectWebhookApply } =
				await import('../../src/app/connect-webhook-apply-data.ts')
			return (
				data.action === 'approve'
					? approveConnectWebhookApply
					: rejectConnectWebhookApply
			)({ env, user, handle: data.handle, fingerprint: data.fingerprint })
		})
	})

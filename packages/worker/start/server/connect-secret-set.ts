import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
export const loadConnectSecretSet = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/connect\/secret-set(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid secret setup URL.')
		return href
	})
	.handler(async ({ data: href }) => {
		const { withWebsiteRead } = await import('./mutation-context.ts')
		const search = new URL(href, 'https://kody.local').searchParams
		const org = search.get('org')?.trim()
		try {
			return await withWebsiteRead(
				{ scope: org ? { orgSlug: org } : undefined },
				async ({ env, request, user }) => {
					const { loadAccountSecretsData } =
						await import('../../src/app/account-secrets-data.ts')
					const { loadDocumentHead } = await import('./document-head.ts')
					const url = new URL(href, request.url)
					const payload = await loadAccountSecretsData({
						env,
						user,
						request,
						search: url.search,
					})
					return {
						payload,
						head: loadDocumentHead(
							url.pathname,
							{ accountSecrets: payload },
							url.search,
						),
					}
				},
			)
		} catch (error) {
			if (error instanceof Error && error.message === 'Please sign in again.')
				throw redirect({
					href: `/login?redirectTo=${encodeURIComponent(href)}`,
				})
			if (error instanceof Error && error.message === 'Organization not found.')
				throw notFound()
			throw error
		}
	})

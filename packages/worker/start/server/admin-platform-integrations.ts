import { createServerFn } from '@tanstack/react-start'

export const loadAdminPlatformIntegrations = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/platform-integrations(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadAdminPlatformIntegrationsData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/admin-platform-integrations-data.ts'),
				import('./document-head.ts'),
			])
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { bindings, url, user } = await readAdminPageContext(href)
		if (!user) {
			return {
				forbidden: true as const,
				head: loadDocumentHead(
					url.pathname.split('/')[3] === 'new'
						? 'adminPlatformIntegrationNew'
						: url.pathname.split('/')[3]
							? 'adminPlatformIntegrationDetail'
							: 'adminPlatformIntegrations',
					href,
				),
			}
		}
		const payload = await loadAdminPlatformIntegrationsData(bindings)
		return {
			forbidden: false as const,
			payload,
			head: loadDocumentHead(
				url.pathname.split('/')[3] === 'new'
					? 'adminPlatformIntegrationNew'
					: url.pathname.split('/')[3]
						? 'adminPlatformIntegrationDetail'
						: 'adminPlatformIntegrations',
				url.pathname,
				undefined,
				url.search,
			),
		}
	})

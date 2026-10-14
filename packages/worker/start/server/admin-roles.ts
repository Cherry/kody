import { createServerFn } from '@tanstack/react-start'

export const loadAdminRoles = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (typeof href !== 'string' || !/^\/admin\/roles(?:\?[^#]*)?$/.test(href))
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadAdminRolesData }, { loadDocumentHead }] = await Promise.all([
			import('../../src/app/admin-roles-data.ts'),
			import('./document-head.ts'),
		])
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { bindings, url, user } = await readAdminPageContext(href)
		if (!user) {
			return {
				forbidden: true as const,
				head: loadDocumentHead(href),
			}
		}
		const payload = await loadAdminRolesData(bindings)
		return {
			forbidden: false as const,
			payload,
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

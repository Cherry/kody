import { createServerFn } from '@tanstack/react-start'

export const loadAdminUsers = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/users(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadAdminUsersData }, { loadDocumentHead }] = await Promise.all([
			import('../../src/admin/users-data.ts'),
			import('./document-head.ts'),
		])
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { bindings, request, url, user } = await readAdminPageContext(href)
		if (!user) {
			return {
				forbidden: true as const,
				head: loadDocumentHead(href),
			}
		}
		return {
			forbidden: false as const,
			payload: await loadAdminUsersData(
				bindings,
				(() => {
					const url = new URL(request.url)
					url.searchParams.delete('page')
					return url.toString()
				})(),
				url.pathname.split('/')[3],
			),
			head: loadDocumentHead(href),
		}
	})

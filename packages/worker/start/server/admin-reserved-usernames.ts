import { createServerFn } from '@tanstack/react-start'

export const loadAdminReservedUsernames = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/reserved-usernames(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadAdminReservedUsernamesData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/admin-reserved-usernames-data.ts'),
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
		const payload = await loadAdminReservedUsernamesData(bindings)
		return {
			forbidden: false as const,
			payload,
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

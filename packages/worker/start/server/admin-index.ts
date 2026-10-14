import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

/** Only the matched admin index redirects, after checking the current principal. */
export const loadAdminIndex = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (typeof href !== 'string' || !/^\/admin\/?(?:\?[^#]*)?$/.test(href))
			throw new Error('Invalid admin index destination')
		return href
	})
	.handler(async ({ data: href }) => {
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { user } = await readAdminPageContext(href)
		if (!user) return { forbidden: true as const }
		throw redirect({ to: '/admin/users', statusCode: 302 })
	})

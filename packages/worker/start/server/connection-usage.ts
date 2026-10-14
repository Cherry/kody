import { accountAliasPath } from '#universal/org-pages.ts'
import { createServerFn } from '@tanstack/react-start'

export const loadConnectionUsagePage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!href.startsWith('/') ||
			href.startsWith('//') ||
			href.includes('\\') ||
			!/^\/account\/agents(?:\/usage)?$/.test(
				accountAliasPath(new URL(href, 'https://kody.local').pathname),
			)
		)
			throw new Error('Invalid connection usage URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadCollection }, { loadAccountConnectionUsageData }] =
			await Promise.all([
				import('./account-collections.ts'),
				import('../../src/app/handlers/account-connection-usage.ts'),
			])
		const { bindings: env, user } = await loadCollection(href)
		return loadAccountConnectionUsageData({ env, user })
	})

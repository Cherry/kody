import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { accountAliasPath } from '#universal/org-pages.ts'
import { type AccountConnectionUsageLoaderData } from '#universal/connection-usage.ts'

export const loadConnectionUsagePage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!href.startsWith('/') ||
			href.startsWith('//') ||
			href.includes('\\') ||
			!/^\/account\/connections(?:\/usage)?$/.test(
				accountAliasPath(new URL(href, 'https://kody.local').pathname),
			)
		)
			throw new Error('Invalid connection usage URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ readAccountConnectionUsage },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/account-connection-usage.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		setResponseHeader('Cache-Control', 'no-store')
		const original = getRequest()
		const headers = new Headers(original.headers)
		headers.set('Referer', new URL(href, original.url).href)
		const request = new Request(
			new URL('/account/connection-usage.json', original.url),
			{ headers },
		)
		const response = await readAccountConnectionUsage(request, bindings)
		if (response.status === 401)
			throw redirect({ href: `/login?redirectTo=${encodeURIComponent(href)}` })
		if (response.status === 404) throw notFound()
		if (!response.ok) throw new Error('Unable to load connection usage.')
		return (await response.json()) as AccountConnectionUsageLoaderData
	})

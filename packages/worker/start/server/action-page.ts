import { createServerFn } from '@tanstack/react-start'
import { actionPagePaths } from '../action-pages.ts'

export const loadActionPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!href.startsWith('/') ||
			href.startsWith('//') ||
			href.includes('\\')
		)
			throw new Error('Invalid action page')
		const url = new URL(href, 'https://kody.local')
		if (!actionPagePaths.has(url.pathname))
			throw new Error('Invalid action page')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseStatus, setResponseHeader },
			{ getEnv },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
		])
		const url = new URL(href, getRequest().url)
		const request = new Request(url, { headers: getRequest().headers })
		const bindings = getEnv(env)
		const loaders = {
			'/verify-email': () =>
				import('../../src/app/handlers/verify-email.ts').then((m) =>
					m.loadVerifyEmailPage(request, bindings),
				),
			'/verify-email-change': () =>
				import('../../src/app/handlers/verify-email-change.ts').then((m) =>
					m.loadVerifyEmailChangePage(request, bindings),
				),
			'/verify-email-claim-release': () =>
				import('../../src/app/handlers/verify-email-claim-release.ts').then(
					(m) => m.loadVerifyEmailClaimReleasePage(request, bindings),
				),
			'/verify-email-destination': () =>
				import('../../src/app/handlers/verify-email-destination.ts').then((m) =>
					m.loadVerifyEmailDestinationPage(request, bindings),
				),
			'/unsubscribe/tips': () =>
				import('../../src/app/handlers/unsubscribe-tips.ts').then((m) =>
					m.loadUnsubscribeTipsPage(request, bindings),
				),
		}
		const operation = loaders[url.pathname as keyof typeof loaders]
		if (!operation) throw new Error('Unknown action page')
		const result = await operation()
		if (result instanceof Response)
			throw new Error('Unexpected non-page action response')
		setResponseStatus(result.status ?? 200)
		if (result.extraSetCookies?.length)
			setResponseHeader('Set-Cookie', result.extraSetCookies)
		return { title: result.title, loaderData: result.loaderData }
	})

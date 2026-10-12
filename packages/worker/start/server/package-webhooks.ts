import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { type PackageWebhooksLoaderData } from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
export const loadPackageWebhooks = createServerFn({ method: 'GET' })
	.validator((input: { username: string; kodyId: string }) => {
		if (
			!input ||
			typeof input.username !== 'string' ||
			typeof input.kodyId !== 'string' ||
			!input.username ||
			!input.kodyId
		)
			throw new Error('Invalid package')
		return { username: input.username, kodyId: input.kodyId }
	})
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ handlePackageWebhooksRequest },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/package-webhooks.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		setResponseHeader('Cache-Control', 'no-store')
		const original = getRequest()
		const url = new URL(
			routes.communityPackageWebhooksApi.href(data),
			original.url,
		)
		const response = await handlePackageWebhooksRequest(
			{
				request: new Request(url, { headers: original.headers }),
				url,
				params: data,
			},
			bindings,
		)
		if (response.status === 401) throw redirect({ href: '/login' })
		if (response.status === 404) throw notFound()
		if (!response.ok) throw new Error('Unable to load webhooks.')
		return (await response.json()) as PackageWebhooksLoaderData
	})

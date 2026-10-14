import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
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
			{ readPackageWebhooksData },
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
		const result = await readPackageWebhooksData(original, data, bindings)

		if (result.status === 401) throw redirect({ href: '/login' })
		if (result.status === 404) throw notFound()
		return result.data
	})

export const updatePackageWebhook = createServerFn({ method: 'POST' })
	.validator(
		(data: {
			username: string
			kodyId: string
			intent: string
			webhookName: string
		}) => {
			if (
				!data ||
				!data.username ||
				!data.kodyId ||
				typeof data.intent !== 'string' ||
				typeof data.webhookName !== 'string'
			)
				throw new Error('Invalid webhook action.')
			return data
		},
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { mutatePackageWebhook } =
			await import('../../src/app/handlers/package-webhooks.ts')
		return withWebsiteMutation(
			{},
			async ({ request, env }) =>
				(
					await mutatePackageWebhook({
						request,
						env,
						params: { username: data.username, kodyId: data.kodyId },
						body: { intent: data.intent, webhookName: data.webhookName },
					})
				).data,
		)
	})

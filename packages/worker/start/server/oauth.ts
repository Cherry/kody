import type {} from '../request-context.ts'
import { createServerFn, getGlobalStartContext } from '@tanstack/react-start'

export const loadOAuthPage = createServerFn({ method: 'GET' })
	.validator((search: string) => {
		if (
			typeof search !== 'string' ||
			(search !== '' && !search.startsWith('?'))
		)
			throw new Error('Invalid search')
		return search
	})
	.handler(async ({ data: search }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ loadSessionInfo },
			{ loadOAuthAuthorizeData },
			{ publicAuthProvidersLoaderData },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/session-info.ts'),
			import('../../src/oauth-handlers.ts'),
			import('../../src/app/public-auth-providers.ts'),
		])
		const bindings = getEnv(env)
		const url = new URL(`/oauth/authorize${search}`, getRequest().url)
		const request = new Request(url, { headers: getRequest().headers })
		const initial = getGlobalStartContext()?.oauthPage
		const initialData =
			initial?.href === url.href
				? initial.loaderData?.oauthAuthorize
				: undefined
		const result = initialData
			? { data: initialData, setCookie: null }
			: await loadOAuthAuthorizeData(request, bindings)
		const { session, setCookie } = await loadSessionInfo(request, bindings)
		const cookies = [result.setCookie, setCookie].filter(
			(cookie): cookie is string => Boolean(cookie),
		)
		if (cookies.length) setResponseHeader('Set-Cookie', cookies)
		return {
			data: result.data,
			session,
			authProviders: publicAuthProvidersLoaderData(bindings),
		}
	})

import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadAuthPage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/(login|signup)(?:\?|$)/.test(href) ||
			href.includes('\\')
		)
			throw new Error('Invalid auth URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ loadSessionInfo },
			{ normalizeRedirectTo },
			{ getEnabledOauthProviders, oauthProviderDefinitions },
			{ getTurnstileSiteKey },
			{ getEnv },
			{ setAuthSessionSecret },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/session-info.ts'),
			import('../../src/app/auth-redirect.ts'),
			import('../../src/app/oauth-providers.ts'),
			import('../../src/app/public-form-protection.ts'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
		])
		const appEnv = getEnv(env)
		setAuthSessionSecret(appEnv.COOKIE_SECRET)
		const { session, setCookie } = await loadSessionInfo(getRequest(), appEnv)
		if (setCookie) setResponseHeader('Set-Cookie', setCookie)
		if (session)
			throw redirect({
				href:
					normalizeRedirectTo(
						new URL(href, getRequest().url).searchParams.get('redirectTo'),
					) ?? '/account',
				statusCode: 302,
			})
		return {
			authConfig: {
				ok: true as const,
				turnstileSiteKey: getTurnstileSiteKey(appEnv),
				providers: getEnabledOauthProviders(appEnv).map((provider) => ({
					id: provider,
					label: oauthProviderDefinitions[provider].label,
				})),
			},
			session,
		}
	})

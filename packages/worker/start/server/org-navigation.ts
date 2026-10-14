import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const rememberOrganization = createServerFn({ method: 'POST' })
	.validator(z.object({ orgSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/) }))
	.handler(async ({ data }) => {
		const { withWebsiteRead } = await import('./mutation-context.ts')
		const { serializeLastUsedOrgCookie } =
			await import('#universal/org-last-used-cookie.ts')
		const { isSecureRequest } = await import('#app/auth-session.ts')
		const { setResponseHeader } = await import('@tanstack/react-start/server')
		return withWebsiteRead(
			{ scope: { orgSlug: data.orgSlug, requireMembership: false } },
			async ({ request }) => {
				setResponseHeader(
					'Set-Cookie',
					serializeLastUsedOrgCookie({
						slug: data.orgSlug,
						secure: isSecureRequest(request),
					}),
				)
				return { ok: true }
			},
		)
	})

export const redirectAccountCredits = createServerFn({ method: 'GET' })
	.inputValidator(z.string().regex(/^\/account\/credits(?:\?[^#]*)?$/))
	.handler(async ({ data: href }) => {
		const { withWebsiteRead, WebsiteAuthenticationError } =
			await import('./mutation-context.ts')
		const { redirect } = await import('@tanstack/react-router')
		const { accountCreditsRedirectUrl } =
			await import('#app/handlers/account-credits.ts')
		const { personalUsageSlug } = await import('#app/handlers/account-usage.ts')
		try {
			return await withWebsiteRead({}, async ({ user, env, request }) => {
				const slug = await personalUsageSlug(env, user)
				throw redirect({
					href: accountCreditsRedirectUrl(
						new URL(href, request.url).href,
						slug,
					),
					statusCode: 302,
					headers: { 'Cache-Control': 'private, no-store' },
				})
			})
		} catch (error) {
			if (error instanceof WebsiteAuthenticationError)
				throw redirect({
					href: `/login?redirectTo=${encodeURIComponent(href)}`,
					statusCode: 302,
				})
			throw error
		}
	})

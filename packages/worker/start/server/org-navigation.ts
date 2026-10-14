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

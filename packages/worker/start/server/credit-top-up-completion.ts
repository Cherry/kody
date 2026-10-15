import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const completeCreditTopUp = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/),
			sessionId: z.string().trim().min(1),
		}),
	)
	.handler(async ({ data }) => {
		const { getRequest } = await import('@tanstack/react-start/server')
		if (getRequest().method === 'HEAD')
			throw new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
		const { loadScopedCollection } = await import('./collection-context.ts')
		const search = new URLSearchParams({
			topup: 'success',
			session_id: data.sessionId,
		})
		await loadScopedCollection({
			orgSlug: data.orgSlug,
			section: 'usage',
			returnTo: `/@${data.orgSlug}/-/usage?${search}#credits`,
		})
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { completeOrgCreditTopUp } =
			await import('../../src/app/handlers/org-usage.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) => {
				const result = await completeOrgCreditTopUp({ ...context, ...data })
				if (result.kind === 'denied')
					throw new Response(result.error, { status: result.status })
				return { href: result.href }
			},
		)
	})

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
export const joinOrganization = createServerFn({ method: 'POST' })
	.validator(z.string().trim().min(1))
	.handler(async ({ data: token }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({}, async (context) => {
			const { joinWebsiteOrganization } =
				await import('../../src/app/handlers/org-invite-join.ts')
			const result = await joinWebsiteOrganization({ ...context, token })
			if (!result.data.ok) throw new Error(result.data.error)
			return {
				alreadyMember: result.data.alreadyMember,
				redirectTo: result.data.redirectTo,
			}
		})
	})

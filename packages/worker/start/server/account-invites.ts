import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
export const updatePendingInvite = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			source: z.enum(['link', 'invite']),
			id: z.string().trim().min(1),
			action: z.enum(['accept', 'decline']),
		}),
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation({}, async (context) => {
			if (data.source === 'link') {
				const { acceptWebsiteInviteLink, declineWebsiteInviteLink } =
					await import('../../src/app/handlers/org-invite-join.ts')
				return resultWithRedirect(
					requireOperationResult(
						await (
							data.action === 'accept'
								? acceptWebsiteInviteLink
								: declineWebsiteInviteLink
						)({ ...context, linkId: data.id }),
					),
				)
			}
			const { acceptWebsiteInvite, declineWebsiteInvite } =
				await import('../../src/app/handlers/account-invites.ts')
			return resultWithRedirect(
				requireOperationResult(
					await (
						data.action === 'accept'
							? acceptWebsiteInvite
							: declineWebsiteInvite
					)({ ...context, inviteId: data.id }),
				),
			)
		})
	})

function resultWithRedirect(result: { ok: true }) {
	return {
		ok: true as const,
		redirectTo:
			'redirectTo' in result && typeof result.redirectTo === 'string'
				? result.redirectTo
				: undefined,
	}
}

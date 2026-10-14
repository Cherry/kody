import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
export const updateOrganizationSettings = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z.string().min(1),
			kind: z.enum(['profile', 'delete', 'remove-avatar', 'domains']),
			body: z.record(z.string(), z.unknown()),
		}),
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) => {
				const operations =
					await import('../../src/app/handlers/org-settings.ts')
				const { requireOperationResult } =
					await import('../../src/app/operation-result.ts')
				const operation =
					data.kind === 'profile'
						? operations.mutateOrgSettingsPost
						: data.kind === 'delete'
							? operations.mutateOrgSettingsDeletePost
							: data.kind === 'domains'
								? operations.mutateOrgSettingsCustomHostnamesPost
								: operations.mutateOrgSettingsAvatarPost
				return requireOperationResult(
					await operation({
						...context,
						orgSlug: data.orgSlug,
						body: data.body,
					}),
				)
			},
		)
	})
export const saveOrganizationAvatar = createServerFn({ method: 'POST' })
	.validator((data: FormData) => {
		if (!(data instanceof FormData) || typeof data.get('orgSlug') !== 'string')
			throw new Error('Invalid avatar form')
		return data
	})
	.handler(async ({ data }) => {
		const orgSlug = String(data.get('orgSlug'))
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({ scope: { orgSlug } }, async (context) => {
			const { mutateOrgSettingsAvatarPost } =
				await import('../../src/app/handlers/org-settings.ts')
			const { requireOperationResult } =
				await import('../../src/app/operation-result.ts')
			return requireOperationResult(
				await mutateOrgSettingsAvatarPost({ ...context, orgSlug, body: data }),
			)
		})
	})

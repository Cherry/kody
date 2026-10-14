import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
const input = z.object({
	orgSlug: z.string().min(1),
	body: z.record(z.string(), z.unknown()),
})
export const startCheckout = createServerFn({ method: 'POST' })
	.validator(input)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { startWebsiteCheckout } =
			await import('../../src/app/handlers/org-billing.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) =>
				requireOperationResult(
					await startWebsiteCheckout({ ...context, ...data }),
				),
		)
	})
export const startCreditTopUp = createServerFn({ method: 'POST' })
	.validator(input)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { startWebsiteCreditTopUp } =
			await import('../../src/app/handlers/account-credits.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) =>
				requireOperationResult(
					await startWebsiteCreditTopUp({ ...context, ...data }),
				),
		)
	})
export const saveCreditSettings = createServerFn({ method: 'POST' })
	.validator(input)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { saveWebsiteCreditSettings } =
			await import('../../src/app/handlers/account-credits.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) =>
				requireOperationResult(
					await saveWebsiteCreditSettings({ ...context, ...data }),
				),
		)
	})
export const sendCancellationFeedback = createServerFn({ method: 'POST' })
	.validator(z.object({ details: z.string().trim().min(1).max(8000) }))
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { submitWebsiteCancellationFeedback } =
			await import('../../src/app/handlers/org-billing.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(
				await submitWebsiteCancellationFeedback({ ...context, body: data }),
			),
		)
	})
export const openBillingPortal = createServerFn({ method: 'POST' })
	.validator(z.object({ orgSlug: z.string().min(1) }))
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { openWebsiteBillingPortal } =
			await import('../../src/app/handlers/org-billing.ts')
		const { requireOperationResult } =
			await import('../../src/app/operation-result.ts')
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug } },
			async (context) =>
				requireOperationResult(
					await openWebsiteBillingPortal({ ...context, ...data }),
				),
		)
	})

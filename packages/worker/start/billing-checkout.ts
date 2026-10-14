export type BillingInterval = 'month' | 'year'
import { startCheckout } from '#start/server/billing-mutations'
export async function requestProCheckout(input: {
	orgSlug: string
	interval?: 'month' | 'year'
	promoCode?: string
}) {
	try {
		const result = await startCheckout({
			data: {
				orgSlug: input.orgSlug,
				body: {
					plan: 'pro',
					interval: input.interval ?? 'month',
					...(input.promoCode?.trim()
						? { promoCode: input.promoCode.trim() }
						: {}),
				},
			},
		})
		return { ok: true as const, url: result.url, mode: result.mode ?? null }
	} catch (error) {
		return {
			ok: false as const,
			error:
				error instanceof Error
					? error.message
					: 'Unable to start checkout. Try again shortly.',
		}
	}
}

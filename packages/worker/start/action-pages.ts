/** These links perform a token-authorized action when opened. Never prefetch. */
export const actionPagePaths = new Set([
	'/account/billing/success',
	'/verify-email',
	'/verify-email-change',
	'/verify-email-claim-release',
	'/verify-email-destination',
	'/unsubscribe/tips',
])

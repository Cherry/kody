import { getRequest } from '@tanstack/react-start/server'

// Query reads can be speculative or finish after a newer navigation. Only a
// document render may write here. Browser navigation commits through onResolved.
export function isOrgDocumentRequest() {
	return /^\/@[^/]+(?:\/|$)/.test(new URL(getRequest().url).pathname)
}

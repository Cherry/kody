import { useEffect, useState } from 'react'
import { fetchPublicAuthConfig } from '../social-sign-in.ts'
import { renderTurnstileWidgets } from '#client/public-form-protection.ts'

export function usePublicAuthProtection() {
	const [siteKey, setSiteKey] = useState<string | null>(null)
	useEffect(() => {
		const controller = new AbortController()
		void fetchPublicAuthConfig(controller.signal).then((config) => {
			if (!controller.signal.aborted)
				setSiteKey(config?.turnstileSiteKey ?? null)
		})
		return () => controller.abort()
	}, [])
	useEffect(() => {
		if (siteKey) void renderTurnstileWidgets(siteKey)
	}, [siteKey])
	return siteKey
}

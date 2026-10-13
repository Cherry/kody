import { createServerFn } from '@tanstack/react-start'
import { pickOnboardingAgentChooser } from '#universal/onboarding-mcp-clients.ts'

/** Progress belongs to the user, not to a particular wizard URL. */
export const loadOnboarding = createServerFn({ method: 'GET' }).handler(
	async () => {
		const [
			{ env },
			{ getEnv },
			{ getRequest },
			{ setAuthSessionSecret },
			{ readOnboardingPageData },
			{ getCanonicalAppBaseUrl },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/onboarding.ts'),
			import('../../src/app-base-url.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const request = getRequest()
		const { payload } = await readOnboardingPageData(bindings, request)
		return {
			payload,
			onboardingAgentChooser: pickOnboardingAgentChooser(),
			canonicalBaseUrl: getCanonicalAppBaseUrl({
				env: bindings,
				requestUrl: request.url,
			}),
		}
	},
)

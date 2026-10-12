import { createServerFn } from '@tanstack/react-start'
import { type OnboardingPayload } from '../onboarding-types.ts'

/** Progress belongs to the user, not to a particular wizard URL. */
export const loadOnboarding = createServerFn({ method: 'GET' }).handler(
	async () => {
		const [
			{ env },
			{ getEnv },
			{ getRequest },
			{ setAuthSessionSecret },
			{ createOnboardingApiHandler },
			{ RequestContext },
			{ getCanonicalAppBaseUrl },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/onboarding.ts'),
			import('remix/router'),
			import('../../src/app-base-url.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const request = getRequest()
		const response = await createOnboardingApiHandler(bindings).handler(
			new RequestContext(request),
		)
		if (!response.ok) throw new Error('Unable to load onboarding.')
		const payload = (await response.json()) as OnboardingPayload
		if (payload.ok !== true) throw new Error('Invalid onboarding response.')
		return {
			payload,
			canonicalBaseUrl: getCanonicalAppBaseUrl({
				env: bindings,
				requestUrl: request.url,
			}),
		}
	},
)

import { personalOrgId } from '@kody-internal/shared/owner-person-ids.ts'
import { type Action } from 'remix/router'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import {
	loadOnboardingData,
	loadPublicOnboardingData,
} from '#app/onboarding-data.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { type routes } from '#universal/routes.ts'
import {
	onboardingStepPaths,
	onboardingWizardStepHref,
	parseOnboardingPathname,
} from '#universal/onboarding-process.ts'
import { pickOnboardingAgentChooser } from '#universal/onboarding-mcp-clients.ts'
import {
	pushServerTiming,
	type ServerTimingEntry,
} from '#worker/server-timing.ts'
import {
	attachOnboardingProgress,
	loadOnboardingChooserFields,
	redirectOnboardingIndex,
	redirectUnverifiedToPending,
	withOnboardingHighlights,
} from './onboarding.ts'

export function createOnboardingHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const requestUrl = new URL(request.url)
			if (requestUrl.pathname === onboardingStepPaths.index) {
				return redirectOnboardingIndex(env, request)
			}
			const location = parseOnboardingPathname(requestUrl.pathname)
			if (location && !location.valid) {
				const target = new URL(
					onboardingWizardStepHref(location.step, requestUrl.search),
					request.url,
				)
				return Response.redirect(target, 302)
			}
			const serverTiming: Array<ServerTimingEntry> = []
			const user = await readAuthenticatedAppUser(request, env, {
				prefetchFeatureFlags: true,
			})
			if (!user) {
				const { persistContext: _persistContext, ...chooser } =
					await pushServerTiming(serverTiming, 'listings', () =>
						loadOnboardingChooserFields(env, request),
					)
				const onboarding = await withOnboardingHighlights(
					env,
					{
						...loadPublicOnboardingData({
							env,
							requestUrl: request.url,
						}),
						...chooser,
					},
					serverTiming,
				)
				return renderAppPage({
					request,
					env,
					loaderData: {
						onboarding,
						onboardingAgentChooser: pickOnboardingAgentChooser(),
					},
					serverTiming,
				})
			}

			if (!user.emailVerified) {
				return redirectUnverifiedToPending(request)
			}

			const chooser = await pushServerTiming(serverTiming, 'listings', () =>
				loadOnboardingChooserFields(
					env,
					request,
					personalOrgId(user.mcpUser.userId),
				),
			)
			const onboarding = await loadOnboardingData({
				env,
				requestUrl: request.url,
				stableUserId: personalOrgId(user.mcpUser.userId),
				username: user.username,
				emailVerified: user.emailVerified,
				...chooser,
			})
			await attachOnboardingProgress(
				env,
				personalOrgId(user.mcpUser.userId),
				user.username,
				onboarding,
			)
			return renderAppPage({
				request,
				env,
				loaderData: {
					onboarding: await withOnboardingHighlights(
						env,
						onboarding,
						serverTiming,
					),
					onboardingAgentChooser: pickOnboardingAgentChooser(),
				},
				serverTiming,
			})
		},
	} satisfies Action<
		| typeof routes.onboarding
		| typeof routes.onboardingStep1
		| typeof routes.onboardingStep1Agent
		| typeof routes.onboardingStep2
		| typeof routes.onboardingStep2Service
		| typeof routes.onboardingStep3
		| typeof routes.onboardingStep3Agent
	>
}

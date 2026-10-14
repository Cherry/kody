/** @jsxImportSource @emotion/react */
import { useCallback } from 'react'
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { usePageQuery } from '../page-query.ts'
import { onboardingQuery, onboardingNeedsRefresh } from '../onboarding-query.ts'
import { OnboardingRoute } from '../pages/onboarding.tsx'

export const Route = createFileRoute('/onboarding')({
	head: staticDocumentHead('onboarding'),
	component: OnboardingLayout,
})
function OnboardingLayout() {
	const { actorKey } = Route.useRouteContext()
	const { data, refetch } = usePageQuery({
		...onboardingQuery(actorKey, undefined),
		refetchInterval: (query) =>
			onboardingNeedsRefresh(query.state.data?.payload) ? 4000 : false,
	})
	const refresh = useCallback(() => {
		if (data.payload.loggedIn) void refetch({ cancelRefetch: false })
	}, [data.payload.loggedIn, refetch])
	return (
		<OnboardingRoute
			payload={data.payload}
			initialAgentChooser={data.onboardingAgentChooser}
			refresh={refresh}
		/>
	)
}

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { PricingPage } from '../pages/pricing.tsx'
import { useShellData } from './__root.tsx'
import { isFeatureFlagEnabled } from '#client/feature-flags.ts'
import { jevSearchRerankFlagKey } from '#universal/feature-flags/registry.ts'

export const Route = createFileRoute('/pricing')({
	head: () => ({ meta: [{ title: 'Pricing | Kody' }] }),
	component: Pricing,
})
function Pricing() {
	const { session } = useShellData()
	return (
		<PricingPage
			isSignedIn={session !== null}
			showImprovedSearch={isFeatureFlagEnabled(session, jevSearchRerankFlagKey)}
		/>
	)
}

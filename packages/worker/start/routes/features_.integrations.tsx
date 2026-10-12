/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { IntegrationsFeature } from '../pages/features/integrations.tsx'
export const Route = createFileRoute('/features_/integrations')({
	head: () => ({ links: [{ rel: 'stylesheet', href: '/feature-pages.css' }] }),
	component: () => (
		<FeaturePage>
			<IntegrationsFeature />
		</FeaturePage>
	),
})

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { FeaturesOverview } from '../pages/features/overview.tsx'
export const Route = createFileRoute('/features')({
	head: () => ({ links: [{ rel: 'stylesheet', href: '/feature-pages.css' }] }),
	component: () => (
		<FeaturePage overview>
			<FeaturesOverview />
		</FeaturePage>
	),
})

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { FeaturesOverview } from '../pages/features/overview.tsx'
export const Route = createFileRoute('/features')({
	component: () => (
		<FeaturePage overview>
			<FeaturesOverview />
		</FeaturePage>
	),
})

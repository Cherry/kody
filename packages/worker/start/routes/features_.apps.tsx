/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { AppsFeature } from '../pages/features/apps.tsx'
export const Route = createFileRoute('/features_/apps')({
	component: () => (
		<FeaturePage>
			<AppsFeature />
		</FeaturePage>
	),
})

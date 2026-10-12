/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { TriggersFeature } from '../pages/features/triggers.tsx'
export const Route = createFileRoute('/features_/triggers')({
	component: () => (
		<FeaturePage>
			<TriggersFeature />
		</FeaturePage>
	),
})

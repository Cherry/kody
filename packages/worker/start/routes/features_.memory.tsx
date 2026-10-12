/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { MemoryFeature } from '../pages/features/memory.tsx'
export const Route = createFileRoute('/features_/memory')({
	component: () => (
		<FeaturePage>
			<MemoryFeature />
		</FeaturePage>
	),
})

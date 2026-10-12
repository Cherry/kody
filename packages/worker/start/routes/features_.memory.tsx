/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { MemoryFeature } from '../pages/features/memory.tsx'
export const Route = createFileRoute('/features_/memory')({
	head: () => ({ links: [{ rel: 'stylesheet', href: '/feature-pages.css' }] }),
	component: () => (
		<FeaturePage>
			<MemoryFeature />
		</FeaturePage>
	),
})

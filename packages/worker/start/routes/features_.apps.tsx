/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { AppsFeature } from '../pages/features/apps.tsx'
export const Route = createFileRoute('/features_/apps')({
	head: () => ({ links: [{ rel: 'stylesheet', href: '/feature-pages.css' }] }),
	component: () => (
		<FeaturePage>
			<AppsFeature />
		</FeaturePage>
	),
})

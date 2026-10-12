/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { PackagesFeature } from '../pages/features/packages.tsx'
export const Route = createFileRoute('/features_/packages')({
	head: () => ({ links: [{ rel: 'stylesheet', href: '/feature-pages.css' }] }),
	component: () => (
		<FeaturePage>
			<PackagesFeature />
		</FeaturePage>
	),
})

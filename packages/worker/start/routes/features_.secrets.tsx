/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { SecretsFeature } from '../pages/features/secrets.tsx'
export const Route = createFileRoute('/features_/secrets')({
	component: () => (
		<FeaturePage>
			<SecretsFeature />
		</FeaturePage>
	),
})

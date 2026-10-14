/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { SecretsFeature } from '../pages/features/secrets.tsx'
export const Route = createFileRoute('/features_/secrets')({
	head: staticDocumentHead('featureSecrets'),
	component: () => (
		<FeaturePage>
			<SecretsFeature />
		</FeaturePage>
	),
})

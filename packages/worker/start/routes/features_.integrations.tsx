/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { IntegrationsFeature } from '../pages/features/integrations.tsx'
export const Route = createFileRoute('/features_/integrations')({
	staticData: { shell: { gutters: 'page' }, sessionVerification: 'public' },
	head: staticDocumentHead('featureIntegrations'),
	component: () => (
		<FeaturePage>
			<IntegrationsFeature />
		</FeaturePage>
	),
})

/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { createFileRoute } from '@tanstack/react-router'
import { FeaturePage } from '../pages/features.tsx'
import { TriggersFeature } from '../pages/features/triggers.tsx'
export const Route = createFileRoute('/features_/triggers')({
	head: staticDocumentHead('featureTriggers'),
	component: () => (
		<FeaturePage>
			<TriggersFeature />
		</FeaturePage>
	),
})

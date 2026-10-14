/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ComposioAlternativesPage } from '../pages/acquisition/composioAlternatives.tsx'
export const Route = createFileRoute('/compare_/composio-alternatives')({
	head: staticDocumentHead('composioAlternatives'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="composioAlternatives">
			<ComposioAlternativesPage />
		</AcquisitionPage>
	),
})

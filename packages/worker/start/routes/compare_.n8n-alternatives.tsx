/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { N8nAlternativesPage } from '../pages/acquisition/n8nAlternatives.tsx'
export const Route = createFileRoute('/compare_/n8n-alternatives')({
	head: staticDocumentHead('n8nAlternatives'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="n8nAlternatives">
			<N8nAlternativesPage />
		</AcquisitionPage>
	),
})

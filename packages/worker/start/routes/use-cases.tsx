/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { UseCasesPage } from '../pages/acquisition/useCases.tsx'
export const Route = createFileRoute('/use-cases')({
	head: staticDocumentHead('useCases'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="useCases">
			<UseCasesPage />
		</AcquisitionPage>
	),
})

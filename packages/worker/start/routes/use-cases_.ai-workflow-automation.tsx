/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { AutomationPage } from '../pages/acquisition/automation.tsx'
export const Route = createFileRoute('/use-cases_/ai-workflow-automation')({
	head: staticDocumentHead('automation'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="automation">
			<AutomationPage />
		</AcquisitionPage>
	),
})

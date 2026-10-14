/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ScheduledWorkflowsPage } from '../pages/acquisition/scheduledWorkflows.tsx'
export const Route = createFileRoute('/use-cases_/scheduled-workflows')({
	head: staticDocumentHead('scheduledWorkflows'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="scheduledWorkflows">
			<ScheduledWorkflowsPage />
		</AcquisitionPage>
	),
})

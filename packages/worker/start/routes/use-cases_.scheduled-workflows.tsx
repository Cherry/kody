/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ScheduledWorkflowsPage } from '../pages/acquisition/scheduledWorkflows.tsx'
export const Route = createFileRoute('/use-cases_/scheduled-workflows')({
	component: () => (
		<AcquisitionPage pageKey="scheduledWorkflows">
			<ScheduledWorkflowsPage />
		</AcquisitionPage>
	),
})

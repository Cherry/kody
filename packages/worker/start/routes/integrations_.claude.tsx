/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ClaudeIntegrationsPage } from '../pages/acquisition/claudeIntegrations.tsx'
export const Route = createFileRoute('/integrations_/claude')({
	component: () => (
		<AcquisitionPage pageKey="claudeIntegrations">
			<ClaudeIntegrationsPage />
		</AcquisitionPage>
	),
})

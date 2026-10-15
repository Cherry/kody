/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ClaudeIntegrationsPage } from '../pages/acquisition/claudeIntegrations.tsx'
export const Route = createFileRoute('/integrations_/claude')({
	staticData: { shell: { gutters: 'page' }, sessionVerification: 'public' },
	head: staticDocumentHead('claudeIntegrations'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="claudeIntegrations">
			<ClaudeIntegrationsPage />
		</AcquisitionPage>
	),
})

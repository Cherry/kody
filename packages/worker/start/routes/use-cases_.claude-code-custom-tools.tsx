/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { CustomToolsPage } from '../pages/acquisition/customTools.tsx'
export const Route = createFileRoute('/use-cases_/claude-code-custom-tools')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="customTools">
			<CustomToolsPage />
		</AcquisitionPage>
	),
})

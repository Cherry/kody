/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { CustomToolsPage } from '../pages/acquisition/customTools.tsx'
export const Route = createFileRoute('/use-cases_/claude-code-custom-tools')({
	component: () => (
		<AcquisitionPage pageKey="customTools">
			<CustomToolsPage />
		</AcquisitionPage>
	),
})

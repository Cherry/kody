/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { N8nAlternativesPage } from '../pages/acquisition/n8nAlternatives.tsx'
export const Route = createFileRoute('/compare_/n8n-alternatives')({
	component: () => (
		<AcquisitionPage pageKey="n8nAlternatives">
			<N8nAlternativesPage />
		</AcquisitionPage>
	),
})

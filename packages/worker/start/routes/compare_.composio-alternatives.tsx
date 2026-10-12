/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { ComposioAlternativesPage } from '../pages/acquisition/composioAlternatives.tsx'
export const Route = createFileRoute('/compare_/composio-alternatives')({
	component: () => (
		<AcquisitionPage pageKey="composioAlternatives">
			<ComposioAlternativesPage />
		</AcquisitionPage>
	),
})

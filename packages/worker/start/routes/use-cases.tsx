/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { UseCasesPage } from '../pages/acquisition/useCases.tsx'
export const Route = createFileRoute('/use-cases')({
	component: () => (
		<AcquisitionPage pageKey="useCases">
			<UseCasesPage />
		</AcquisitionPage>
	),
})

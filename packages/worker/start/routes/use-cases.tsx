/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { UseCasesPage } from '../pages/acquisition/useCases.tsx'
export const Route = createFileRoute('/use-cases')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="useCases">
			<UseCasesPage />
		</AcquisitionPage>
	),
})

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { SharedMemoryPage } from '../pages/acquisition/sharedMemory.tsx'
export const Route = createFileRoute('/use-cases_/shared-agent-memory')({
	component: () => (
		<AcquisitionPage pageKey="sharedMemory">
			<SharedMemoryPage />
		</AcquisitionPage>
	),
})

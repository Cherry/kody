/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { SharedMemoryPage } from '../pages/acquisition/sharedMemory.tsx'
export const Route = createFileRoute('/use-cases_/shared-agent-memory')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="sharedMemory">
			<SharedMemoryPage />
		</AcquisitionPage>
	),
})

/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { SharedMemoryPage } from '../pages/acquisition/sharedMemory.tsx'
export const Route = createFileRoute('/use-cases_/shared-agent-memory')({
	staticData: { shell: { gutters: 'page' }, sessionVerification: 'public' },
	head: staticDocumentHead('sharedMemory'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="sharedMemory">
			<SharedMemoryPage />
		</AcquisitionPage>
	),
})

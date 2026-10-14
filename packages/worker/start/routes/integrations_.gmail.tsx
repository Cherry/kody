/** @jsxImportSource @emotion/react */
import { staticDocumentHead } from '../components/document-head.ts'
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { GmailPage } from '../pages/acquisition/gmail.tsx'
export const Route = createFileRoute('/integrations_/gmail')({
	head: staticDocumentHead('gmail'),
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="gmail">
			<GmailPage />
		</AcquisitionPage>
	),
})

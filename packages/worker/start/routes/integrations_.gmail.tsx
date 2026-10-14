/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { GmailPage } from '../pages/acquisition/gmail.tsx'
export const Route = createFileRoute('/integrations_/gmail')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="gmail">
			<GmailPage />
		</AcquisitionPage>
	),
})

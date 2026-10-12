/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { GmailPage } from '../pages/acquisition/gmail.tsx'
export const Route = createFileRoute('/integrations_/gmail')({
	component: () => (
		<AcquisitionPage pageKey="gmail">
			<GmailPage />
		</AcquisitionPage>
	),
})

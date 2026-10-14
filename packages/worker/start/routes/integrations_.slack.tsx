/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { SlackPage } from '../pages/acquisition/slack.tsx'
export const Route = createFileRoute('/integrations_/slack')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="slack">
			<SlackPage />
		</AcquisitionPage>
	),
})

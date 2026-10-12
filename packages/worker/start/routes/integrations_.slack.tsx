/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { SlackPage } from '../pages/acquisition/slack.tsx'
export const Route = createFileRoute('/integrations_/slack')({
	component: () => (
		<AcquisitionPage pageKey="slack">
			<SlackPage />
		</AcquisitionPage>
	),
})

/** @jsxImportSource @emotion/react */
import { acquisitionMarkdown } from '#start/server/markdown'
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { McpGatewayPage } from '../pages/acquisition/mcpGateway.tsx'
export const Route = createFileRoute('/use-cases_/mcp-gateway')({
	server: { handlers: { GET: acquisitionMarkdown } },
	component: () => (
		<AcquisitionPage pageKey="mcpGateway">
			<McpGatewayPage />
		</AcquisitionPage>
	),
})

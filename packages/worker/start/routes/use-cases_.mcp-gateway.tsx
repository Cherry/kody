/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { AcquisitionPage } from '../pages/acquisition.tsx'
import { McpGatewayPage } from '../pages/acquisition/mcpGateway.tsx'
export const Route = createFileRoute('/use-cases_/mcp-gateway')({
	component: () => (
		<AcquisitionPage pageKey="mcpGateway">
			<McpGatewayPage />
		</AcquisitionPage>
	),
})

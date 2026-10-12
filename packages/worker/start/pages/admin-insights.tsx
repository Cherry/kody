/** @jsxImportSource @emotion/react */
import { useLocation } from '@tanstack/react-router'
import { type AdminInsightsLoaderData } from '#universal/loader-data.ts'
import {
	AccountManagementShell,
	AdminPageHeader,
} from './account-management-components.tsx'
import { renderDashboard } from './admin-insights-dashboard.tsx'
export function AdminInsightsRoute({
	data,
}: {
	data: AdminInsightsLoaderData
}) {
	const currentHref = useLocation({ select: (l) => l.href })
	return (
		<AccountManagementShell maxWidth="min(100%, 92rem)">
			<AdminPageHeader
				title="Admin insights"
				description="Launch signals, paid mix, cost vs pay, and platform activity. Aggregated account metadata only, user content is never shown."
				currentHref={currentHref}
			/>
			{renderDashboard(data)}
		</AccountManagementShell>
	)
}

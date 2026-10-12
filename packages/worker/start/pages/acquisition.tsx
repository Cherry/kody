/** @jsxImportSource @emotion/react */
import { type ReactNode } from 'react'
import { trackAcquisitionOnboardingClick } from '#client/acquisition-analytics.ts'
export function AcquisitionPage({
	pageKey,
	children,
}: {
	pageKey: string
	children: ReactNode
}) {
	return (
		<div
			style={{ display: 'contents' }}
			onClick={(event) => {
				const target = event.target instanceof Element ? event.target : null
				if (target?.closest('a')?.getAttribute('href') === '/onboarding')
					trackAcquisitionOnboardingClick(pageKey)
			}}
		>
			{children}
		</div>
	)
}

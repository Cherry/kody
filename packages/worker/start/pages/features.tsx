/** @jsxImportSource @emotion/react */
import { type ReactNode } from 'react'
import {
	layoutMaxWidths,
	pageGutter,
} from '#universal/styles/style-primitives.ts'
export function FeaturePage({
	children,
	overview = false,
}: {
	children: ReactNode
	overview?: boolean
}) {
	return (
		<div
			className={overview ? 'feature-overview' : 'feature-detail'}
			css={{
				'--feature-max-width': layoutMaxWidths.extended,
				'--feature-gutter': pageGutter,
			}}
		>
			{children}
		</div>
	)
}

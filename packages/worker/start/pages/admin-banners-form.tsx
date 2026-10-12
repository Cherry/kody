/** @jsxImportSource @emotion/react */
import { type ReactNode, type FormEvent } from 'react'
import { SiteBannerEditor } from '../components/site-banner-editor.tsx'
import {
	siteBannerLooks,
	siteBannerPreviewLookParam,
} from '#universal/site-banners.ts'
import {
	descriptionCss,
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { mq, spacing, typography } from '#universal/styles/tokens.ts'
import { AdminBannerTargetingCard } from './admin-banners-targeting.tsx'
import {
	lookLabel,
	type BannerDraft,
} from '#client/routes/admin-banners-shared.ts'
export function AdminBannerForm(props: {
	draft: BannerDraft
	updatedAt: string | null
	isMutating: boolean
	actionState: 'idle' | 'saving' | 'deleting'
	onDraftChange: (draft: BannerDraft) => void
	onSave: (event: FormEvent<HTMLFormElement>) => void
	onDelete: () => void
	children?: ReactNode
}) {
	const primaryButtonCss = getPillButtonCss({ size: 'sm' })
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const {
		draft,
		updatedAt,
		isMutating,
		actionState,
		onDraftChange,
		onSave,
		onDelete,
		children,
	} = props
	const setDraft = (patch: Partial<BannerDraft>) => {
		onDraftChange({ ...draft, ...patch })
	}
	return (
		<form
			method="post"
			onSubmit={onSave}
			css={{ display: 'grid', gap: spacing.lg }}
		>
			<div
				css={{
					display: 'flex',
					flexWrap: 'wrap',
					justifyContent: 'space-between',
					gap: spacing.sm,
					alignItems: 'center',
				}}
			>
				<h2
					css={{
						margin: 0,
						fontSize: typography.fontSize.lg,
						fontWeight: typography.fontWeight.semibold,
					}}
				>
					{draft.id ? 'Edit banner' : 'New banner'}
				</h2>
				<div
					css={{
						display: 'flex',
						flexWrap: 'wrap',
						gap: spacing.sm,
						alignItems: 'center',
					}}
				>
					{siteBannerLooks.map((look) => (
						<button
							key={look}
							type="button"
							aria-pressed={draft.look === look}
							onClick={() => {
								setDraft({ look })
							}}
							css={draft.look === look ? primaryButtonCss : secondaryButtonCss}
						>
							{lookLabel(look)}
						</button>
					))}
				</div>
			</div>
			<SiteBannerEditor draft={draft} onDraftChange={onDraftChange} />
			<p css={{ ...descriptionCss, margin: 0 }}>
				What visitors see. Click any text to edit. Homepage check:{' '}
				<code>
					?{siteBannerPreviewLookParam}={draft.look}
				</code>
			</p>
			<div
				css={{
					display: 'grid',
					gap: spacing.lg,
					gridTemplateColumns: 'minmax(16rem, 18rem) minmax(0, 1fr)',
					alignItems: 'start',
					[mq.tablet]: {
						gridTemplateColumns: 'minmax(0, 1fr)',
					},
				}}
			>
				{children}
				<AdminBannerTargetingCard
					draft={draft}
					updatedAt={updatedAt}
					isMutating={isMutating}
					actionState={actionState}
					onDraftChange={onDraftChange}
					onDelete={onDelete}
				/>
			</div>
		</form>
	)
}

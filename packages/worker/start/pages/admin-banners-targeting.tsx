/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { formatNullableTimestamp } from '../components/local-timestamp.tsx'
import { planNames } from '#universal/plans.ts'
import {
	siteBannerAudiences,
	siteBannerIcons,
	siteBannerPageTargetings,
	siteBannerSeverities,
	type SiteBannerAudience,
	type SiteBannerIcon,
	type SiteBannerPageTargeting,
	type SiteBannerSeverity,
} from '#universal/site-banners.ts'
import {
	cardCss,
	descriptionCss,
	fieldCss,
	fieldLabelCss,
	getDangerPillCss,
	getPillButtonCss,
	getSelectCss,
} from '#universal/styles/style-primitives.ts'
import { colors, mq, spacing, typography } from '#universal/styles/tokens.ts'
import {
	accountInputCss,
	accountTextareaCss,
} from './account-management-components.tsx'
import {
	applyYoutubeWatchToBannerDraft,
	audienceLabel,
	type BannerDraft,
} from '#client/routes/admin-banners-shared.ts'
const selectCss = getSelectCss()
export function AdminBannerTargetingCard(props: {
	draft: BannerDraft
	updatedAt: string | null
	isMutating: boolean
	actionState: 'idle' | 'saving' | 'deleting'
	onDraftChange: (draft: BannerDraft) => void
	onDelete: () => void
}) {
	const primaryButtonCss = getPillButtonCss({ size: 'sm' })
	const dangerButtonCss = getDangerPillCss({ size: 'sm' })
	const [youtubeInput, setYoutubeInput] = useState('')
	const [deleteArmed, setDeleteArmed] = useState(false)
	const [youtubeError, setYoutubeError] = useState<string | null>(null)
	const { draft, updatedAt, isMutating, actionState, onDraftChange, onDelete } =
		props
	const setDraft = (patch: Partial<BannerDraft>) => {
		onDraftChange({ ...draft, ...patch })
	}
	return (
		<section css={{ ...cardCss, display: 'grid', gap: spacing.md }}>
			<h3
				css={{
					margin: 0,
					fontSize: typography.fontSize.base,
					fontWeight: typography.fontWeight.semibold,
				}}
			>
				Media and targeting
			</h3>
			<div
				css={{
					display: 'grid',
					gap: spacing.md,
					gridTemplateColumns: '1fr 1fr',
					[mq.mobile]: { gridTemplateColumns: '1fr' },
				}}
			>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Severity</span>
					<select
						value={draft.severity}
						onChange={(event) => {
							if (!(event.currentTarget instanceof HTMLSelectElement)) return
							setDraft({
								severity: event.currentTarget.value as SiteBannerSeverity,
							})
						}}
						css={selectCss}
					>
						{siteBannerSeverities.map((severity) => (
							<option key={severity} value={severity}>
								{severity}
							</option>
						))}
					</select>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Icon</span>
					<select
						value={draft.icon}
						onChange={(event) => {
							if (!(event.currentTarget instanceof HTMLSelectElement)) return
							setDraft({
								icon: event.currentTarget.value as SiteBannerIcon | '',
							})
						}}
						css={selectCss}
					>
						<option value="">None</option>
						{siteBannerIcons.map((icon) => (
							<option key={icon} value={icon}>
								{icon}
							</option>
						))}
					</select>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Priority</span>
					<input
						type="number"
						min="0"
						max="1000"
						value={draft.priority}
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setDraft({ priority: event.currentTarget.value })
						}}
						css={accountInputCss}
					/>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Image URL (optional)</span>
					<input
						value={draft.imageUrl}
						placeholder="/youtube-thumb/… or first-party path"
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setDraft({ imageUrl: event.currentTarget.value })
						}}
						css={accountInputCss}
					/>
				</label>
			</div>
			<div css={{ display: 'grid', gap: spacing.sm }}>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>YouTube video (optional)</span>
					<input
						value={youtubeInput}
						placeholder="https://www.youtube.com/watch?v=…"
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setYoutubeInput(event.currentTarget.value)
							setYoutubeError(null)
						}}
						css={accountInputCss}
					/>
				</label>
				<p css={{ ...descriptionCss, margin: 0 }}>
					Paste a watch URL, youtu.be link, or video id. This sets the CTA to{' '}
					<code>/?youtubeId=</code> and the image to the first-party thumbnail.
				</p>
				{youtubeError ? (
					<p
						css={{
							...descriptionCss,
							margin: 0,
							color: colors.danger,
						}}
					>
						{youtubeError}
					</p>
				) : null}
				<button
					type="button"
					onClick={() => {
						const result = applyYoutubeWatchToBannerDraft(draft, youtubeInput)
						if (!result.ok) {
							setYoutubeError(result.error)
							return
						}
						setYoutubeError(null)
						onDraftChange(result.draft)
					}}
					css={primaryButtonCss}
				>
					Use for this banner
				</button>
			</div>
			<label css={fieldCss}>
				<span css={fieldLabelCss}>Page targeting</span>
				<select
					value={draft.pageTargeting}
					onChange={(event) => {
						if (!(event.currentTarget instanceof HTMLSelectElement)) return
						setDraft({
							pageTargeting: event.currentTarget
								.value as SiteBannerPageTargeting,
						})
					}}
					css={selectCss}
				>
					{siteBannerPageTargetings.map((targeting) => (
						<option key={targeting} value={targeting}>
							{targeting === 'all' ? 'All pages' : 'Route patterns'}
						</option>
					))}
				</select>
			</label>
			{draft.pageTargeting === 'routes' ? (
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Route patterns (one per line)</span>
					<textarea
						value={draft.routePatterns}
						placeholder={'/blog\n/pricing\n/account/**'}
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLTextAreaElement)) return
							setDraft({ routePatterns: event.currentTarget.value })
						}}
						css={{ ...accountTextareaCss, minHeight: '4.5rem' }}
					/>
				</label>
			) : null}
			<label css={fieldCss}>
				<span css={fieldLabelCss}>Audience</span>
				<select
					value={draft.audience}
					onChange={(event) => {
						if (!(event.currentTarget instanceof HTMLSelectElement)) return
						setDraft({
							audience: event.currentTarget.value as SiteBannerAudience,
						})
					}}
					css={selectCss}
				>
					{siteBannerAudiences.map((audience) => (
						<option key={audience} value={audience}>
							{audienceLabel(audience)}
						</option>
					))}
				</select>
			</label>
			{draft.audience === 'users' ? (
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Stable user ids</span>
					<textarea
						value={draft.audienceUserIds}
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLTextAreaElement)) return
							setDraft({ audienceUserIds: event.currentTarget.value })
						}}
						css={{ ...accountTextareaCss, minHeight: '4.5rem' }}
					/>
				</label>
			) : null}
			{draft.audience === 'plans' ? (
				<fieldset
					css={{
						border: `1px solid ${colors.border}`,
						borderRadius: '0.75rem',
						margin: 0,
						padding: spacing.md,
						display: 'grid',
						gap: spacing.sm,
					}}
				>
					<legend css={fieldLabelCss}>Plans</legend>
					{planNames.map((plan) => (
						<label
							key={plan}
							css={{
								display: 'flex',
								gap: spacing.sm,
								alignItems: 'center',
							}}
						>
							<input
								type="checkbox"
								checked={draft.audiencePlans.includes(plan)}
								onChange={() => {
									setDraft({
										audiencePlans: draft.audiencePlans.includes(plan)
											? draft.audiencePlans.filter((item) => item !== plan)
											: [...draft.audiencePlans, plan],
									})
								}}
							/>
							{plan}
						</label>
					))}
				</fieldset>
			) : null}
			<div
				css={{
					display: 'grid',
					gap: spacing.md,
					gridTemplateColumns: '1fr 1fr',
					[mq.mobile]: { gridTemplateColumns: '1fr' },
				}}
			>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Starts at (ISO, optional)</span>
					<input
						value={draft.startsAt}
						placeholder="2026-09-10T15:00:00.000Z"
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setDraft({ startsAt: event.currentTarget.value })
						}}
						css={accountInputCss}
					/>
				</label>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Ends at (ISO, optional)</span>
					<input
						value={draft.endsAt}
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setDraft({ endsAt: event.currentTarget.value })
						}}
						css={accountInputCss}
					/>
				</label>
			</div>
			<label
				css={{
					display: 'flex',
					gap: spacing.sm,
					alignItems: 'center',
				}}
			>
				<input
					type="checkbox"
					checked={draft.enabled}
					onChange={() => {
						setDraft({ enabled: !draft.enabled })
					}}
				/>
				Enabled
			</label>
			{draft.id ? (
				<p css={{ ...descriptionCss, margin: 0 }}>
					Updated {formatNullableTimestamp(updatedAt)}
				</p>
			) : null}
			<div
				css={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: spacing.sm,
				}}
			>
				<button type="submit" disabled={isMutating} css={primaryButtonCss}>
					{actionState === 'saving' ? 'Saving…' : 'Save banner'}
				</button>
				{draft.id ? (
					<button
						type="button"
						disabled={isMutating}
						onClick={() => {
							if (!deleteArmed) setDeleteArmed(true)
							else {
								onDelete()
								setDeleteArmed(false)
							}
						}}
						onBlur={() => setDeleteArmed(false)}
						css={dangerButtonCss}
					>
						{deleteArmed
							? 'Click again to delete'
							: actionState === 'deleting'
								? 'Deleting…'
								: 'Delete'}
					</button>
				) : null}
			</div>
		</section>
	)
}

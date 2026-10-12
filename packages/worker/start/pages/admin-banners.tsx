/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { type AdminBannersLoaderData } from '#universal/loader-data.ts'
import {
	cardCss,
	descriptionCss,
	getGhostButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AdminPageHeader,
} from './account-management-components.tsx'
import { AdminBannerForm } from './admin-banners-form.tsx'
import {
	adminBannersApiPath,
	audienceLabel,
	bannerAfterSave,
	draftFromBanner,
	draftToInput,
	emptyDraft,
	type BannerDraft,
} from '#client/routes/admin-banners-shared.ts'
type ActionState = 'idle' | 'saving' | 'deleting'
export function AdminBannersPage({
	payload,
	currentHref,
}: {
	payload: AdminBannersLoaderData
	currentHref: string
}) {
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshShell: true,
	})
	const [editedData, setEditedData] = useState<{
		source: typeof payload
		rows: typeof payload.banners
	} | null>(null)
	const banners =
		editedData?.source === payload ? editedData.rows : payload.banners
	const [draft, setDraft] = useState<BannerDraft>(emptyDraft)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [actionState, setActionState] = useState<ActionState>('idle')
	const pendingRequest = useRef<AbortController | null>(null)
	useEffect(() => () => pendingRequest.current?.abort(), [])
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	function applyData(nextPayload: AdminBannersLoaderData) {
		setEditedData({ source: payload, rows: nextPayload.banners })
		setMessage(null)
		setMessageTone('info')
		setDraft((current) =>
			current.id &&
			!nextPayload.banners.some((banner) => banner.id === current.id)
				? emptyDraft()
				: current,
		)
	}
	async function submitAdminAction(
		body: Record<string, unknown>,
		nextActionState: Exclude<ActionState, 'idle'>,
		successMessage: string,
	): Promise<AdminBannersLoaderData | null> {
		pendingRequest.current?.abort()
		const controller = new AbortController()
		pendingRequest.current = controller
		setActionState(nextActionState)
		setMessage(null)
		setMessageTone('info')
		try {
			const response = await fetch(adminBannersApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(body),
				signal: controller.signal,
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return null
			}
			const payload = await readJson<
				AdminBannersLoaderData & {
					ok?: boolean
					error?: string
				}
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error ?? 'Unable to update banners.')
			}
			applyData(payload)
			void invalidatePages()
			setMessage(successMessage)
			setMessageTone('info')
			return payload
		} catch (error) {
			if (controller.signal.aborted) return null
			setMessage(
				error instanceof Error ? error.message : 'Unable to update banners.',
			)
			setMessageTone('error')
			return null
		} finally {
			if (!controller.signal.aborted) setActionState('idle')
		}
	}
	function handleSaveSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const wasCreate = draft.id === null
		void submitAdminAction(
			{ action: 'save', ...draftToInput(draft) },
			'saving',
			wasCreate ? 'Banner created.' : 'Banner saved.',
		).then((payload) => {
			if (!payload || !wasCreate) return
			const created = bannerAfterSave(payload.banners, payload.savedBannerId)
			if (created) setDraft(draftFromBanner(created))
		})
	}
	function handleDelete() {
		if (!draft.id) return
		void submitAdminAction(
			{ action: 'delete', id: draft.id },
			'deleting',
			'Banner deleted.',
		).then((ok) => {
			if (ok) setDraft(emptyDraft())
		})
	}
	return (
		<AccountManagementShell busy={actionState !== 'idle'}>
			<AdminPageHeader
				title="Admin banners"
				description="Create, target, and enable site announcement banners. Edit the strip itself before you save. Content is live without a deploy."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			<AdminBannerForm
				draft={draft}
				updatedAt={
					banners.find((banner) => banner.id === draft.id)?.updatedAt ?? null
				}
				isMutating={actionState !== 'idle'}
				actionState={actionState}
				onDraftChange={(next) => {
					setDraft(next)
				}}
				onSave={handleSaveSubmit}
				onDelete={handleDelete}
			>
				<section css={cardCss}>
					<div
						css={{
							display: 'flex',
							justifyContent: 'space-between',
							gap: spacing.sm,
							alignItems: 'center',
							marginBottom: spacing.md,
						}}
					>
						<h2
							css={{
								margin: 0,
								fontSize: typography.fontSize.lg,
								fontWeight: typography.fontWeight.semibold,
							}}
						>
							Banners
						</h2>
						<button
							type="button"
							onClick={() => {
								setDraft(emptyDraft())
							}}
							css={secondaryButtonCss}
						>
							New
						</button>
					</div>
					{banners.length === 0 ? (
						<p css={{ ...descriptionCss, margin: 0 }}>
							No banners yet. Create one to announce the launch video.
						</p>
					) : (
						<ul
							css={{
								listStyle: 'none',
								margin: 0,
								padding: 0,
								display: 'grid',
								gap: spacing.sm,
							}}
						>
							{banners.map((banner) => (
								<li key={banner.id}>
									<button
										type="button"
										onClick={() => {
											setDraft(draftFromBanner(banner))
										}}
										css={{
											width: '100%',
											textAlign: 'left',
											padding: spacing.sm,
											borderRadius: '0.75rem',
											border: `1px solid ${
												draft.id === banner.id ? colors.primary : colors.border
											}`,
											backgroundColor:
												draft.id === banner.id
													? colors.primarySoftest
													: colors.surface,
											cursor: 'pointer',
										}}
									>
										<strong
											css={{
												display: 'block',
												fontSize: typography.fontSize.sm,
											}}
										>
											{banner.title}
										</strong>
										<span
											css={{
												color: colors.textMuted,
												fontSize: typography.fontSize.xs,
											}}
										>
											{banner.enabled ? 'Enabled' : 'Disabled'} · p
											{banner.priority} · {banner.look} ·{' '}
											{audienceLabel(banner.audience)}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</section>
			</AdminBannerForm>
		</AccountManagementShell>
	)
}

const mutationResources = ['loadAdminBanners'] as const

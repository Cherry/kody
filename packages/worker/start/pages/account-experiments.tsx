/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { useState } from 'react'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
	accountFieldCss,
	accountFieldLabelCss,
	accountFieldNoteCss,
} from './account-management-components.tsx'
import { type AccountExperimentsLoaderData } from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'

export function AccountExperimentsPage({
	payload: initialPayload,
	currentHref,
}: {
	payload: AccountExperimentsLoaderData
	currentHref: string
}) {
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [saving, setSaving] = useState(false)
	const [payload, setPayload] =
		useState<AccountExperimentsLoaderData>(initialPayload)
	const invalidatePages = usePageInvalidation('permissions', {
		refreshShell: true,
	})

	async function saveOptIn(enabled: boolean) {
		if (saving) return
		const previous = payload
		setSaving(true)
		setMessage(null)
		if (payload?.ok) {
			setPayload({ ...payload, experimentsOptIn: enabled })
		}
		try {
			const response = await fetch(routes.accountExperimentsApiPost.href(), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ experimentsOptIn: enabled }),
			})
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const next = await readJson<AccountExperimentsLoaderData>(response)
			if (!response.ok || !next?.ok) {
				throw new Error(
					(next && 'error' in next && typeof next.error === 'string'
						? next.error
						: null) ?? 'Unable to update experiments preference.',
				)
			}
			setPayload(next)
			void invalidatePages()
			setMessage(
				enabled
					? 'You are opted into experiments. You can turn this off anytime.'
					: 'You are opted out of experiments.',
			)
			setMessageTone('info')
		} catch (error) {
			setPayload(previous)
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update experiments preference.',
			)
			setMessageTone('error')
		} finally {
			setSaving(false)
		}
	}

	const [lastPayload, setLastPayload] = useState(initialPayload)
	if (lastPayload !== initialPayload && !saving) {
		setLastPayload(initialPayload)
		setPayload(initialPayload)
	}

	return (
		<AccountManagementShell busy={saving}>
			<AccountPageHeader
				title="Experiments"
				description="Opt into early, unfinished work. Things may change or break; you can leave anytime."
				currentHref={currentHref}
			/>

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			{payload ? (
				<AccountManagementPanel
					title="Account experiments"
					description="When you opt in, feature flags that target the experiments audience can include you. This does not turn every experiment on by itself — operators still enable each flag."
				>
					<label
						css={{
							...accountFieldCss,
							display: 'grid',
							gridTemplateColumns: 'auto 1fr',
							gap: spacing.md,
							alignItems: 'start',
						}}
					>
						<input
							type="checkbox"
							checked={payload.experimentsOptIn}
							disabled={saving}
							onChange={(event) => {
								if (!(event.currentTarget instanceof HTMLInputElement)) {
									return
								}
								void saveOptIn(event.currentTarget.checked)
							}}
							css={{
								width: '1.25rem',
								height: '1.25rem',
								marginTop: '0.2rem',
								accentColor: colors.primary,
							}}
						/>
						<span>
							<span
								css={{
									...accountFieldLabelCss,
									display: 'block',
									marginBottom: spacing.xs,
									fontSize: typography.fontSize.base,
								}}
							>
								Opt into experiments
							</span>
							<span css={accountFieldNoteCss}>
								Expect unfinished UI, changing behavior, and occasional rough
								edges. Opt out here whenever you want to leave the audience.
							</span>
						</span>
					</label>
					{payload.experimentsOptIn ? (
						<p
							css={{
								margin: 0,
								marginTop: spacing.lg,
								color: colors.textMuted,
								fontSize: typography.fontSize.sm,
								maxWidth: '60ch',
							}}
						>
							You are in the experiments audience. Individual flags still need
							to be enabled (globally, by percentage, or by override) before you
							see them.
						</p>
					) : (
						<p
							css={{
								margin: 0,
								marginTop: spacing.lg,
								color: colors.textMuted,
								fontSize: typography.fontSize.sm,
								maxWidth: '60ch',
							}}
						>
							No experiments are targeted at you while this is off. When
							something is ready for a wider dogfood, it can use this audience —
							you will only see it after you opt in and the flag is on for you.
						</p>
					)}
					{saving ? (
						<p
							css={{
								margin: 0,
								marginTop: spacing.md,
								color: colors.textMuted,
								fontSize: typography.fontSize.sm,
							}}
						>
							Saving…
						</p>
					) : null}
				</AccountManagementPanel>
			) : null}
		</AccountManagementShell>
	)
}

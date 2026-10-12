/** @jsxImportSource @emotion/react */
import { usePageInvalidation } from '../page-invalidation.ts'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { formatTimestampDate } from '../components/local-timestamp.tsx'
import { readJson } from '#client/routes/account-approval-shared.ts'
import {
	formatSignedMicroUsd,
	parseDollarsToCents,
} from '#client/routes/credit-amount-input.ts'
import {
	creditAdminGrantNoteMaxLength,
	formatCents,
	formatMicroUsd,
	signupWelcomeCreditLedgerIdPrefix,
	validateCreditAdminGrantCents,
} from '#universal/credits.ts'
import {
	type AccountCreditsLedgerItem,
	type AdminCreditWalletSummary,
} from '#universal/loader-data.ts'
import { colors, mq, spacing, typography } from '#universal/styles/tokens.ts'
import {
	fieldCss,
	fieldLabelCss,
	getAuthInputCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	MetadataGrid,
} from './account-management-components.tsx'
import { adminUserCreditsApiPath } from '#client/routes/admin-users-shared.ts'
const ledgerKindLabels: Record<AccountCreditsLedgerItem['kind'], string> = {
	top_up: 'Top-up',
	auto_refill: 'Auto-refill',
	admin_grant: 'Admin grant',
	debit: 'Debit',
}
type CreditsStatus = 'loading' | 'ready' | 'error'
/**
 * Credit wallet for the selected account: balance, eligibility, a grant
 * form, and the recent ledger. Keyed by `stableUserId` so switching users
 * starts from a fresh load.
 */
export function AdminUserCreditsPanel(props: {
	stableUserId: string
	onGranted?: () => void
}) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const [status, setStatus] = useState<CreditsStatus>('loading')
	const [wallet, setWallet] = useState<AdminCreditWalletSummary | null>(null)
	const lifetime = useRef<AbortController | null>(null)

	const [amountText, setAmountText] = useState('')
	const [noteText, setNoteText] = useState('')
	const [granting, setGranting] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	async function loadWallet(stableUserId: string) {
		try {
			const response = await fetch(
				`${adminUserCreditsApiPath}?stableUserId=${encodeURIComponent(stableUserId)}`,
				{
					headers: { Accept: 'application/json' },
					credentials: 'include',
					signal: lifetime.current?.signal,
				},
			)
			if (lifetime.current?.signal.aborted) return
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				| AdminCreditWalletSummary
				| {
						ok: false
						error?: string
				  }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(
					(payload && 'error' in payload ? payload.error : null) ||
						'Unable to load credits for this account.',
				)
			}
			setWallet(payload)
			setStatus('ready')
		} catch (error) {
			if (lifetime.current?.signal.aborted) return
			setStatus('error')
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to load credits for this account.',
			)
			setMessageTone('error')
		}
	}
	useEffect(() => {
		const controller = new AbortController()
		lifetime.current = controller
		void loadWallet(props.stableUserId)
		return () => controller.abort()
	}, [props.stableUserId])
	async function submitGrant(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (granting) return
		const amount = validateCreditAdminGrantCents(
			parseDollarsToCents(amountText) ?? Number.NaN,
		)
		if (!amount.ok) {
			setMessage(amount.error)
			setMessageTone('error')

			return
		}
		const note = noteText.trim()
		if (note.length > creditAdminGrantNoteMaxLength) {
			setMessage(
				`Keep the note under ${creditAdminGrantNoteMaxLength} characters.`,
			)
			setMessageTone('error')

			return
		}
		setGranting(true)
		setMessage(null)

		try {
			const response = await fetch(adminUserCreditsApiPath, {
				method: 'POST',
				signal: lifetime.current?.signal,
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					stableUserId: props.stableUserId,
					amountCents: amount.cents,
					...(note ? { note } : {}),
				}),
			})
			if (lifetime.current?.signal.aborted) return
			if (response.status === 401) {
				window.location.assign('/login')
				return
			}
			const payload = await readJson<
				| AdminCreditWalletSummary
				| {
						ok: false
						error?: string
				  }
			>(response)
			if (!response.ok || !payload?.ok) {
				throw new Error(
					(payload && 'error' in payload ? payload.error : null) ||
						'Unable to grant credits.',
				)
			}
			setWallet(payload)
			setStatus('ready')
			setAmountText('')
			setNoteText('')
			setMessage(`Granted ${formatCents(amount.cents)}.`)
			setMessageTone('info')
			void invalidatePages()
			props.onGranted?.()
		} catch (error) {
			if (lifetime.current?.signal.aborted) return
			setMessage(
				error instanceof Error ? error.message : 'Unable to grant credits.',
			)
			setMessageTone('error')
		}
		setGranting(false)
	}

	return (
		<AccountManagementPanel
			title="Credits"
			description="Prepaid wallet. Grants add to the balance immediately and are recorded with your username."
		>
			{status === 'loading' && !wallet ? (
				<p css={{ margin: 0, color: colors.textMuted }}>Loading credits…</p>
			) : null}
			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			{wallet ? (
				<>
					<MetadataGrid
						items={[
							{
								label: 'Balance',
								value: (
									<span
										data-admin-credits-balance
										css={{
											fontVariantNumeric: 'tabular-nums',
											color:
												wallet.balanceMicroUsd < 0 ? colors.error : colors.text,
										}}
									>
										{formatMicroUsd(wallet.balanceMicroUsd)}
									</span>
								),
							},
							{
								label: 'Credit wallet',
								value: wallet.eligible
									? 'Eligible (Pro)'
									: `Not eligible (${wallet.plan})`,
							},
							{
								label: 'Admin eligibility',
								value: wallet.adminCreditsEligible ? 'On' : 'Off',
							},
							{
								label: 'Past include',
								value: wallet.unlocked
									? 'Runs on credits'
									: wallet.eligible
										? 'Stops (no credits)'
										: 'Plan hard caps',
							},
						]}
					/>
					<form
						method="post"
						noValidate
						aria-label="Grant credits"
						onSubmit={(event: FormEvent<HTMLFormElement>) =>
							void submitGrant(event)
						}
						css={{
							display: 'grid',
							gap: spacing.md,
							gridTemplateColumns: 'minmax(0, 10rem) minmax(0, 1fr) auto',
							alignItems: 'end',
							[mq.mobile]: { gridTemplateColumns: '1fr' },
						}}
					>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Amount ($)</span>
							<input
								type="text"
								inputMode="decimal"
								autoComplete="off"
								value={amountText}
								disabled={granting}
								data-field-ring
								onInput={(event) => {
									setAmountText((event.currentTarget as HTMLInputElement).value)
								}}
								css={inputCss}
							/>
						</label>
						<label css={fieldCss}>
							<span css={fieldLabelCss}>Note (optional)</span>
							<input
								type="text"
								autoComplete="off"
								maxLength={creditAdminGrantNoteMaxLength}
								value={noteText}
								disabled={granting}
								data-field-ring
								onInput={(event) => {
									setNoteText((event.currentTarget as HTMLInputElement).value)
								}}
								css={inputCss}
							/>
						</label>
						<button
							type="submit"
							disabled={granting || amountText.trim() === ''}
							css={primaryButtonCss}
						>
							{granting ? 'Granting…' : 'Grant'}
						</button>
					</form>
					{wallet.recent.length === 0 ? (
						<p css={{ margin: 0, color: colors.textMuted }}>
							No credit activity yet.
						</p>
					) : (
						<ul
							aria-label="Recent credit activity"
							css={{
								margin: 0,
								padding: 0,
								listStyle: 'none',
								display: 'grid',
								gap: spacing.sm,
							}}
						>
							{wallet.recent.map((item) => (
								<li
									key={item.id}
									data-admin-credits-ledger-kind={item.kind}
									css={{
										display: 'grid',
										gap: '0.15rem',
										fontSize: typography.fontSize.sm,
									}}
								>
									<span
										css={{
											display: 'flex',
											flexWrap: 'wrap',
											gap: spacing.sm,
											fontVariantNumeric: 'tabular-nums',
										}}
									>
										<strong>{ledgerKindLabels[item.kind]}</strong>
										<span>{formatSignedMicroUsd(item.amountMicroUsd)}</span>
										<span css={{ color: colors.textMuted }}>
											{formatTimestampDate(item.createdAt)}
										</span>
									</span>
									{item.kind === 'admin_grant' ? (
										<span css={{ color: colors.textMuted }}>
											by{' '}
											{item.grantedByUsername ??
												(item.id.startsWith(signupWelcomeCreditLedgerIdPrefix)
													? 'signup'
													: 'unknown admin')}
											{item.note ? ` — ${item.note}` : ''}
										</span>
									) : (
										<span css={{ color: colors.textMuted }}>
											{item.description}
										</span>
									)}
								</li>
							))}
						</ul>
					)}
				</>
			) : null}
		</AccountManagementPanel>
	)
}
const inputCss = { ...getAuthInputCss(), width: '100%' }
const primaryButtonCss = getPillButtonCss({ size: 'sm' })

const mutationResources = [
	'loadAdminUsers',
	'loadUsagePage',
	'loadBillingPage',
] as const

/** @jsxImportSource @emotion/react */
import { type CSSObject } from '@emotion/react'
import { useState, useRef, type FormEvent } from 'react'
import { accountDeletionConfirmationPhrase } from '#universal/account-deletion-confirmation.ts'
import { passwordManagerIgnoreProps } from '#client/password-manager-ignore.ts'
import { routes } from '#universal/routes.ts'
import {
	colors,
	radius,
	shadows,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	getAccentCalloutCss,
	getDangerPillCss,
	getGhostButtonCss,
} from '#universal/styles/style-primitives.ts'
import {
	accountActionsCss,
	accountFieldCss,
	accountFieldLabelCss,
	accountFieldNoteCss,
	accountInputCss,
} from './account-management-components.tsx'

type DeleteStatus = 'idle' | 'deleting' | 'deleted'

type AccountDeleteRefundSummary = { amount: string; currency: string }

type AccountDeletePayload = {
	error?: string
	ok?: boolean
	refunds?: Array<AccountDeleteRefundSummary>
} | null

function formatRefundAmounts(refunds: Array<AccountDeleteRefundSummary>) {
	const amounts = refunds.map((refund) => refund.amount)
	if (amounts.length <= 1) return amounts[0] ?? ''
	return `${amounts.slice(0, -1).join(', ')} and ${amounts[amounts.length - 1]}`
}

export function AccountDeletePanel(props: { hasUsablePassword: boolean }) {
	const [confirmation, setConfirmation] = useState('')
	const [password, setPassword] = useState('')
	const [status, setStatus] = useState<DeleteStatus>('idle')
	const [error, setError] = useState<string | null>(null)
	const [refundNotice, setRefundNotice] = useState<string | null>(null)
	const dialogNode = useRef<HTMLDialogElement>(null)

	function closeDialog() {
		if (status === 'deleted') {
			window.location.assign('/')
			return
		}
		setConfirmation('')
		setPassword('')
		setError(null)
		setStatus('idle')
		dialogNode.current?.close()
	}

	function openDialog() {
		setConfirmation('')
		setPassword('')
		setError(null)
		setStatus('idle')
		dialogNode.current?.showModal()
	}

	function updateConfirmation(event: FormEvent<HTMLInputElement>) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		setConfirmation(event.currentTarget.value)
	}

	function updatePassword(event: FormEvent<HTMLInputElement>) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		setPassword(event.currentTarget.value)
	}

	async function handleDeleteSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setStatus('deleting')
		setError(null)

		try {
			const response = await fetch(routes.accountDelete.href(), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					confirmation,
					...(props.hasUsablePassword ? { password } : {}),
				}),
			})
			const payload = (await response
				.json()
				.catch(() => null)) as AccountDeletePayload
			if (response.status === 401 && !payload?.error) {
				window.location.assign('/login')
				return
			}
			if (!response.ok || !payload?.ok) {
				throw new Error(payload?.error || 'Unable to delete your account.')
			}
			const refunds = payload.refunds ?? []
			if (refunds.length === 0) {
				window.location.assign('/')
				return
			}
			// A refund is worth a moment of the user's attention before they are
			// sent home; the session cookie is already gone at this point.
			setRefundNotice(
				`A prorated refund of ${formatRefundAmounts(refunds)} for unused time has been issued to your original payment method; it can take 5–10 business days to appear.`,
			)
			setStatus('deleted')
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: 'Unable to delete your account.',
			)
			setStatus('idle')
		}
	}

	{
		const isDeleting = status === 'deleting'
		const confirmationMatches =
			confirmation.trim() === accountDeletionConfirmationPhrase
		const canSubmit =
			confirmationMatches &&
			(!props.hasUsablePassword || password.length > 0) &&
			!isDeleting

		return (
			<>
				<div css={{ display: 'grid', gap: spacing.md, maxWidth: '36rem' }}>
					<p css={accountFieldNoteCss}>
						This permanently deletes your account, packages, jobs, email,
						secrets, and stored data. Download an export first if you want a
						copy.
					</p>
					<div css={accountActionsCss}>
						<button
							type="button"
							data-testid="delete-account"
							css={getDangerPillCss({ size: 'sm' })}
							onClick={openDialog}
						>
							Delete account
						</button>
					</div>
				</div>
				<dialog
					aria-labelledby="delete-account-title"
					data-testid="delete-account-dialog"
					ref={dialogNode}
					css={deleteDialogCss}
					onCancel={(event) => {
						event.preventDefault()
						closeDialog()
					}}
					onClick={(event) => {
						if (event.target === event.currentTarget) closeDialog()
					}}
				>
					{status === 'deleted' ? (
						<div
							data-testid="delete-account-refund-notice"
							css={deleteDialogFormCss}
						>
							<h3 id="delete-account-title" css={deleteDialogTitleCss}>
								Your Kody account has been deleted
							</h3>
							<p css={{ margin: 0 }}>{refundNotice}</p>
							<div css={accountActionsCss}>
								<button
									type="button"
									data-testid="delete-account-done"
									css={getGhostButtonCss({ size: 'sm' })}
									onClick={() => window.location.assign('/')}
								>
									Return home
								</button>
							</div>
						</div>
					) : (
						<form
							method="dialog"
							css={deleteDialogFormCss}
							onSubmit={handleDeleteSubmit}
						>
							<h3 id="delete-account-title" css={deleteDialogTitleCss}>
								Delete your Kody account?
							</h3>
							<div
								css={getAccentCalloutCss({
									accentColor: colors.error,
								})}
							>
								<p css={{ margin: 0 }}>
									This cannot be undone. Type{' '}
									<strong>{accountDeletionConfirmationPhrase}</strong> to
									confirm.
								</p>
							</div>
							<label css={accountFieldCss}>
								<span css={accountFieldLabelCss}>
									Type {accountDeletionConfirmationPhrase}
								</span>
								<input
									type="text"
									name="confirmation"
									data-testid="delete-account-confirmation"
									data-field-ring
									autoComplete="off"
									spellCheck={false}
									required
									value={confirmation}
									css={accountInputCss}
									onInput={updateConfirmation}
								/>
							</label>
							{props.hasUsablePassword ? (
								<label css={accountFieldCss}>
									<span css={accountFieldLabelCss}>Current password</span>
									<input
										type="password"
										name="password"
										data-testid="delete-account-password"
										data-field-ring
										required
										{...passwordManagerIgnoreProps}
										value={password}
										css={accountInputCss}
										onInput={updatePassword}
									/>
								</label>
							) : null}
							{error ? (
								<p
									role="alert"
									css={{
										margin: 0,
										color: colors.error,
										fontSize: typography.fontSize.sm,
									}}
								>
									{error}
								</p>
							) : null}
							<div css={accountActionsCss}>
								<button
									type="button"
									disabled={isDeleting}
									css={getGhostButtonCss({ size: 'sm' })}
									onClick={closeDialog}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={!canSubmit}
									data-testid="delete-account-confirm"
									css={getDangerPillCss({ size: 'sm' })}
								>
									{isDeleting ? 'Deleting…' : 'Delete account'}
								</button>
							</div>
						</form>
					)}
				</dialog>
			</>
		)
	}
}

const deleteDialogCss: CSSObject = {
	width: 'min(32rem, calc(100vw - 2rem))',
	maxWidth: '32rem',
	padding: 0,
	border: `1px solid ${colors.border}`,
	borderRadius: radius.lg,
	boxShadow: shadows.md,
	backgroundColor: colors.surface,
	color: colors.text,
	'&::backdrop': {
		backgroundColor: 'oklch(0 0 0 / 0.45)',
	},
}

const deleteDialogFormCss: CSSObject = {
	display: 'grid',
	gap: spacing.md,
	padding: spacing.lg,
}

const deleteDialogTitleCss: CSSObject = {
	margin: 0,
	fontSize: '1.2rem',
	fontWeight: 720,
	letterSpacing: '-0.014em',
	lineHeight: 1.2,
}

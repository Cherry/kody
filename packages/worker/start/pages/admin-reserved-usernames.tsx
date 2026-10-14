/** @jsxImportSource @emotion/react */
import { saveAdminReservedUsernames } from '#start/server/admin-mutations'
import { type AdminReservedUsernamesLoaderData } from '#universal/loader-data.ts'
import {
cardCss,
descriptionCss,
fieldCss,
fieldLabelCss,
getGhostButtonCss,
getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors,mq,spacing,typography } from '#universal/styles/tokens.ts'
import { type QueryKey } from '@tanstack/react-query'
import { useState,type FormEvent } from 'react'
import { usePageResponseMutation } from '../use-page-response-mutation.ts'
import {
AccountManagementMessage,
AccountManagementPanel,
AccountManagementShell,
AdminPageHeader,
IdValue,
accountInputCss,
accountTextareaCss,
} from './account-management-components.tsx'
type ActionState = 'idle' | 'adding' | 'removing'
export function AdminReservedUsernamesPage(props: {
	queryKey: QueryKey
	payload: AdminReservedUsernamesLoaderData
	currentHref: string
}) {
	const { builtIn, added, removed, conflicts } = props.payload
	const mutation = usePageResponseMutation<AdminReservedUsernamesLoaderData>(
		props.queryKey,
		'loadAdminReservedUsernames',
		(body, href) =>
			saveAdminReservedUsernames({
				data: { body, search: new URL(href, 'http://localhost').search },
			}),
	)
	const [builtInQuery, setBuiltInQuery] = useState('')
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [actionState, setActionState] = useState<ActionState>('idle')
	async function submitAdminAction(body: Record<string, unknown>) {
		if (actionState !== 'idle') return false
		setActionState(body.action === 'add' ? 'adding' : 'removing')
		setMessage(null)
		setMessageTone('info')
		try {
			await mutation.submit(body)
			setMessage(
				body.action === 'add'
					? 'Reserved usernames updated.'
					: 'Reserved username removed.',
			)
			setMessageTone('info')
			return true
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: 'Unable to update reserved usernames.',
			)
			setMessageTone('error')
			return false
		} finally {
			setActionState('idle')
		}
	}
	async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const form = event.currentTarget
		const formData = new FormData(form)
		const saved = await submitAdminAction({
			action: 'add',
			text: String(formData.get('usernames') ?? ''),
		})
		if (saved) form.reset()
	}
	const primaryButtonCss = getPillButtonCss({ size: 'sm' })
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })
	const currentHref = props.currentHref
	const pending = false
	const status: string = 'ready'
	const isMutating = actionState !== 'idle'
	const normalizedQuery = builtInQuery.trim().toLowerCase()
	const visibleBuiltIn = normalizedQuery
		? builtIn.filter((name) => name.includes(normalizedQuery))
		: builtIn
	return (
		<AccountManagementShell currentHref={currentHref} busy={pending}>
			<AdminPageHeader
				title="Reserved usernames"
				description="Usernames become {username}.kody.run subdomains and {username}@ mail locals. Built-in names stay locked unless explicitly unreserved; system-email locals and kody-prefixed names cannot be unreserved."
				currentHref={currentHref}
			/>
			{status === 'loading' ? (
				<p css={{ color: colors.textMuted, margin: 0 }}>
					Loading reserved usernames…
				</p>
			) : null}
			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			<AccountManagementPanel
				title="Add reserved names"
				description="Enter one or more DNS-safe labels, separated by commas or new lines."
				asForm
				onSubmit={handleAddSubmit}
			>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Usernames</span>
					<textarea
						data-field-ring
						name="usernames"
						rows={4}
						placeholder="autodiscover, mta-sts"
						disabled={isMutating}
						css={accountTextareaCss}
					/>
				</label>
				<button type="submit" disabled={isMutating} css={primaryButtonCss}>
					{actionState === 'adding' ? 'Adding…' : 'Add'}
				</button>
			</AccountManagementPanel>
			<section css={cardCss}>
				<h2
					css={{
						fontSize: typography.fontSize.lg,
						fontWeight: typography.fontWeight.semibold,
						margin: 0,
					}}
				>
					Conflicts
				</h2>
				<p css={descriptionCss}>
					Registered accounts whose username is in the effective reserved set.
					Resolve these in production before expanding the built-in list.
				</p>
				{status === 'ready' && conflicts.length === 0 ? (
					<p css={{ color: colors.textMuted, margin: 0 }}>
						No registered usernames collide with the effective reserved set.
					</p>
				) : null}
				<div css={{ display: 'grid', gap: spacing.sm }}>
					{conflicts.map((conflict) => (
						<div
							key={conflict.stableUserId}
							css={{
								display: 'flex',
								justifyContent: 'space-between',
								gap: spacing.md,
								flexWrap: 'wrap',
							}}
						>
							<strong>{conflict.username}</strong>
							<IdValue value={conflict.stableUserId} label="stable user id" />
						</div>
					))}
				</div>
			</section>
			<section css={cardCss}>
				<h2
					css={{
						fontSize: typography.fontSize.lg,
						fontWeight: typography.fontWeight.semibold,
						margin: 0,
					}}
				>
					Custom additions
				</h2>
				<p css={descriptionCss}>
					Runtime names stored in platform KV. Removing one makes it available
					again.
				</p>
				{status === 'ready' && added.length === 0 ? (
					<p css={{ color: colors.textMuted, margin: 0 }}>
						No custom reserved usernames.
					</p>
				) : null}
				<div css={{ display: 'grid', gap: spacing.sm }}>
					{added.map((username) => (
						<div
							key={username}
							css={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								gap: spacing.md,
							}}
						>
							<code>{username}</code>
							<button
								type="button"
								disabled={isMutating}
								onClick={() =>
									void submitAdminAction({
										action: 'remove',
										usernames: [username],
									})
								}
								css={secondaryButtonCss}
							>
								{actionState === 'removing' ? 'Removing…' : 'Remove'}
							</button>
						</div>
					))}
				</div>
			</section>
			<section css={cardCss}>
				<h2
					css={{
						fontSize: typography.fontSize.lg,
						fontWeight: typography.fontWeight.semibold,
						margin: 0,
					}}
				>
					Unreserved built-ins
				</h2>
				<p css={descriptionCss}>
					Built-in names that operators have explicitly made available. Restore
					puts them back on the reserved list.
				</p>
				{status === 'ready' && removed.length === 0 ? (
					<p css={{ color: colors.textMuted, margin: 0 }}>
						No built-in names are currently unreserved.
					</p>
				) : null}
				<div css={{ display: 'grid', gap: spacing.sm }}>
					{removed.map((username) => (
						<div
							key={username}
							css={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								gap: spacing.md,
							}}
						>
							<code>{username}</code>
							<button
								type="button"
								disabled={isMutating}
								onClick={() =>
									void submitAdminAction({
										action: 'add',
										usernames: [username],
									})
								}
								css={primaryButtonCss}
							>
								Restore
							</button>
						</div>
					))}
				</div>
			</section>
			<section css={cardCss}>
				<h2
					css={{
						fontSize: typography.fontSize.lg,
						fontWeight: typography.fontWeight.semibold,
						margin: 0,
					}}
				>
					Built-in names
				</h2>
				<p css={descriptionCss}>
					Code-defined denylist. Search to filter. These stay reserved unless
					moved to Unreserved built-ins.
				</p>
				<label css={fieldCss}>
					<span css={fieldLabelCss}>Search</span>
					<input
						data-field-ring
						type="text"
						role="searchbox"
						inputMode="search"
						autoComplete="off"
						placeholder="autodiscover"
						onInput={(event) => {
							if (!(event.currentTarget instanceof HTMLInputElement)) return
							setBuiltInQuery(event.currentTarget.value)
						}}
						css={accountInputCss}
					/>
				</label>
				<p css={{ color: colors.textMuted, margin: 0 }}>
					{visibleBuiltIn.length} of {builtIn.length} names
				</p>
				<ul
					css={{
						display: 'grid',
						gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
						gap: spacing.sm,
						listStyle: 'none',
						margin: 0,
						padding: 0,
						[mq.tablet]: {
							gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
						},
						[mq.mobile]: {
							gridTemplateColumns: 'minmax(0, 1fr)',
						},
					}}
				>
					{visibleBuiltIn.map((username) => (
						<li key={username}>
							<code>{username}</code>
						</li>
					))}
				</ul>
			</section>
		</AccountManagementShell>
	)
}

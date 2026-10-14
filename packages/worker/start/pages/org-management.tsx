/** @jsxImportSource @emotion/react */
import { type ReactNode, useState } from 'react'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { z } from 'zod'
import { CopyTextButton } from '../components/copy-text-button.tsx'
import {
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { getPillButtonCss } from '#universal/styles/style-primitives.ts'
const mutationResult = z.object({
	ok: z.boolean(),
	error: z.string().optional(),
	redirectTo: z.string().optional(),
	invite: z.object({ prompt: z.string() }).optional(),
	inviteLink: z.object({ url: z.string() }).optional(),
})
export function OrgShell({
	title,
	slug,
	children,
}: {
	title: string
	slug: string
	children: ReactNode
}) {
	return (
		<AccountManagementShell>
			<AccountPageHeader
				title={title}
				description={`@${slug}`}
				currentHref={`/@${slug}/-/${title.toLowerCase()}`}
			/>
			{children}
		</AccountManagementShell>
	)
}
export function OrgAction({
	href,
	queryKey,
	children,
	label,
	confirm = false,
	multipart = false,
	disabled = false,
	onDone,
	onSaved,
	renderError,
}: {
	href: string
	queryKey: QueryKey
	children?: ReactNode
	label: string
	confirm?: boolean
	multipart?: boolean
	disabled?: boolean
	onDone?: (href: string) => void
	onSaved?: () => Promise<unknown>
	renderError?: (error: Error) => ReactNode
}) {
	const client = useQueryClient()
	const [confirmed, setConfirmed] = useState(false)
	const mutation = useMutation({
		mutationFn: async (body: FormData) => {
			const response = await fetch(href, {
				method: 'POST',
				credentials: 'include',
				headers: multipart
					? { Accept: 'application/json' }
					: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: multipart
					? body
					: JSON.stringify(
							Object.fromEntries(
								Array.from(body, ([key, value]) => [
									key,
									key === 'remove' ? value === 'true' : value,
								]),
							),
						),
			})
			const data = mutationResult.parse(await response.json())
			if (!response.ok || !data.ok)
				throw new Error(data.error ?? 'Unable to save changes.')
			return data
		},
		onSuccess: async (data) => {
			await Promise.all([
				onSaved?.(),
				client.invalidateQueries({
					predicate: (query) =>
						query.queryKey[0] === queryKey[0] &&
						query.queryKey[1] === queryKey[1] &&
						typeof query.queryKey[3] === 'object' &&
						query.queryKey[3] !== null &&
						'slug' in query.queryKey[3] &&
						typeof queryKey[3] === 'object' &&
						queryKey[3] !== null &&
						'slug' in queryKey[3] &&
						query.queryKey[3].slug === queryKey[3].slug,
				}),
			])
			if (data.redirectTo) onDone?.(data.redirectTo)
		},
	})
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault()
				if (confirm && !confirmed) {
					setConfirmed(true)
					return
				}
				mutation.mutate(new FormData(event.currentTarget))
			}}
			css={{ display: 'grid', gap: '0.75rem', marginBlock: '1rem' }}
		>
			{children}
			<button
				type="submit"
				disabled={disabled || mutation.isPending}
				css={getPillButtonCss()}
			>
				{mutation.isPending
					? 'Saving…'
					: confirm && confirmed
						? `Confirm ${label.toLowerCase()}`
						: label}
			</button>
			{mutation.error ? (
				<>
					<p role="alert">{mutation.error.message}</p>
					{renderError?.(mutation.error)}
				</>
			) : null}
			{mutation.data?.invite?.prompt ? (
				<textarea
					readOnly
					aria-label="Invitation prompt"
					value={mutation.data.invite.prompt}
				/>
			) : null}
			{mutation.data?.inviteLink?.url ? (
				<>
					<input
						readOnly
						aria-label="Invitation link"
						value={mutation.data.inviteLink.url}
					/>
					<CopyTextButton
						value={mutation.data.inviteLink.url}
						idleLabel="Copy invite link"
						ariaLabel="Copy invite link"
						variant="ghost"
						size="sm"
					/>
				</>
			) : null}
			{mutation.isSuccess &&
			!mutation.data.invite &&
			!mutation.data.inviteLink ? (
				<p role="status">Saved.</p>
			) : null}
		</form>
	)
}
export { OrgMembersPage } from './org-members.tsx'
export { OrgTeamsPage } from './org-teams.tsx'
export { OrgSettingsPage } from './org-settings.tsx'
export { OrgGrantsPage } from './org-grants.tsx'
export { OrgCollaboratorsPage } from './org-collaborators.tsx'

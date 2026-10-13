/** @jsxImportSource @emotion/react */
import { type ReactNode, useState, useRef } from 'react'
import {
	useMutation,
	useQueryClient,
	type QueryKey,
} from '@tanstack/react-query'
import { z } from 'zod'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { invalidateShellQueries } from '../shell-query.ts'
import { SiteLink } from '../components/site-link.tsx'
import {
	AccountManagementShell,
	AccountManagementPanel,
	AccountPageHeader,
	accountInputCss,
	accountFieldCss,
	accountFieldLabelCss,
} from './account-management-components.tsx'
import { getPillButtonCss } from '#universal/styles/style-primitives.ts'
import {
	type OrgMembersLoaderData,
	type OrgTeamsLoaderData,
	type OrgSettingsLoaderData,
	type OrgGrantsLoaderData,
	type OrgCollaboratorsLoaderData,
} from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
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
function OrgField({
	label,
	name,
	type = 'text',
	defaultValue,
	required = false,
}: {
	label: string
	name: string
	type?: string
	defaultValue?: string
	required?: boolean
}) {
	return (
		<label css={accountFieldCss}>
			<span css={accountFieldLabelCss}>{label}</span>
			<input
				css={accountInputCss}
				type={type}
				name={name}
				defaultValue={defaultValue}
				required={required}
			/>
		</label>
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
			{mutation.error ? <p role="alert">{mutation.error.message}</p> : null}
			{mutation.data?.invite?.prompt ? (
				<textarea
					readOnly
					aria-label="Invitation prompt"
					value={mutation.data.invite.prompt}
				/>
			) : null}
			{mutation.data?.inviteLink?.url ? (
				<input
					readOnly
					aria-label="Invitation link"
					value={mutation.data.inviteLink.url}
				/>
			) : null}
			{mutation.isSuccess &&
			!mutation.data.invite &&
			!mutation.data.inviteLink ? (
				<p role="status">Saved.</p>
			) : null}
		</form>
	)
}
function RoleSelect({
	name = 'role',
	value = 'member',
	owners = true,
}: {
	name?: string
	value?: string
	owners?: boolean
}) {
	return (
		<label>
			Role
			<select name={name} defaultValue={value} css={accountInputCss}>
				{owners ? <option value="owner">Owner</option> : null}
				<option value="member">Member</option>
				<option value="billing">Billing</option>
			</select>
		</label>
	)
}
export function OrgMembersPage({
	data,
	queryKey,
}: {
	data: OrgMembersLoaderData
	queryKey: QueryKey
}) {
	const args = { orgSlug: data.org.slug }
	return (
		<OrgShell title="Members" slug={data.org.slug}>
			<AccountManagementPanel title="Members">
				{data.members.map((member) => (
					<article key={member.userId}>
						<h3>{member.displayName || member.username || member.userId}</h3>
						<p>{member.roleLabel}</p>
						{data.canManage ? (
							<>
								<OrgAction
									href={routes.orgMembersRolePost.href(args)}
									queryKey={queryKey}
									label="Save role"
								>
									<input type="hidden" name="userId" value={member.userId} />
									<RoleSelect value={member.role} />
								</OrgAction>
								<OrgAction
									href={routes.orgMembersRemovePost.href(args)}
									queryKey={queryKey}
									label="Remove member"
									confirm
								>
									<input type="hidden" name="userId" value={member.userId} />
								</OrgAction>
							</>
						) : null}
					</article>
				))}
			</AccountManagementPanel>
			{data.canManage ? (
				<AccountManagementPanel title="Invite a member">
					<OrgAction
						href={routes.orgMembersInvitePost.href(args)}
						queryKey={queryKey}
						label="Create invite"
					>
						<OrgField label="Email or username" name="invitee" required />
						<RoleSelect />
					</OrgAction>
				</AccountManagementPanel>
			) : null}
			<AccountManagementPanel title="Pending invitations">
				{data.invites.length ? (
					data.invites.map((invite) => (
						<p key={invite.id}>
							{invite.inviteeEmail || invite.inviteeUsername} ·{' '}
							{invite.roleLabel} · Expires {invite.expiresAt}
						</p>
					))
				) : (
					<p>No pending invitations.</p>
				)}
			</AccountManagementPanel>
			<AccountManagementPanel title="Invite links">
				{data.inviteLinks.map((link) => (
					<article key={link.id}>
						<p>
							{link.roleLabel} · {link.useCount}
							{link.maxUses ? ` / ${link.maxUses}` : ''} uses · Expires{' '}
							{link.expiresAt}
						</p>
						<p>{link.allowedEmailDomains.join(', ')}</p>
						{data.canManage ? (
							<OrgAction
								href={routes.orgMembersInviteLinksRevokePost.href(args)}
								queryKey={queryKey}
								label="Revoke link"
								confirm
							>
								<input type="hidden" name="linkId" value={link.id} />
							</OrgAction>
						) : null}
					</article>
				))}
				{data.canManage ? (
					<OrgAction
						href={routes.orgMembersInviteLinksPost.href(args)}
						queryKey={queryKey}
						label="Create invite link"
					>
						<RoleSelect owners={false} />
						<OrgField
							label="Allowed email domains, separated by commas"
							name="allowedEmailDomains"
						/>
						<OrgField
							label="Maximum uses, leave empty for unlimited"
							name="maxUses"
							type="number"
						/>
						<OrgField
							label="Expires in days"
							name="expiresInDays"
							type="number"
							defaultValue="7"
						/>
					</OrgAction>
				) : null}
			</AccountManagementPanel>
		</OrgShell>
	)
}
export function OrgTeamsPage({
	data,
	queryKey,
}: {
	data: OrgTeamsLoaderData
	queryKey: QueryKey
}) {
	const args = { orgSlug: data.org.slug }
	return (
		<OrgShell title="Teams" slug={data.org.slug}>
			{data.canManage ? (
				<AccountManagementPanel title="Create team">
					<OrgAction
						href={routes.orgTeamsCreatePost.href(args)}
						queryKey={queryKey}
						label="Create team"
					>
						<OrgField name="slug" label="Slug" required />
						<OrgField name="name" label="Name" required />
						<OrgField name="description" label="Description" />
					</OrgAction>
				</AccountManagementPanel>
			) : null}
			{data.teams.map((team) => (
				<AccountManagementPanel
					key={team.id}
					title={team.name}
					description={team.description ?? undefined}
				>
					{team.members.map((member) => (
						<article key={member.userId}>
							<p>{member.displayName || member.username || member.userId}</p>
							{data.canRemoveMembers ? (
								<OrgAction
									href={routes.orgTeamsMemberRemovePost.href(args)}
									queryKey={queryKey}
									label="Remove from team"
									confirm
								>
									<input type="hidden" name="teamId" value={team.id} />
									<input type="hidden" name="userId" value={member.userId} />
								</OrgAction>
							) : null}
						</article>
					))}
					{data.canManage ? (
						<OrgAction
							href={routes.orgTeamsMemberAddPost.href(args)}
							queryKey={queryKey}
							label="Add to team"
						>
							<input type="hidden" name="teamId" value={team.id} />
							<label>
								Member
								<select name="userId" css={accountInputCss}>
									{data.orgMembers
										.filter(
											(member) =>
												!team.members.some(
													(item) => item.userId === member.userId,
												),
										)
										.map((member) => (
											<option key={member.userId} value={member.userId}>
												{member.displayName || member.username || member.userId}
											</option>
										))}
								</select>
							</label>
						</OrgAction>
					) : null}
				</AccountManagementPanel>
			))}
		</OrgShell>
	)
}
function DeleteOrganization({
	slug,
	href,
	queryKey,
	onDone,
}: {
	slug: string
	href: string
	queryKey: QueryKey
	onDone: (href: string) => void
}) {
	const dialog = useRef<HTMLDialogElement>(null)
	const [confirmation, setConfirmation] = useState('')
	return (
		<>
			<p>
				This soft-deletes the organization. Members lose access immediately.
				Restoration is possible for 30 days.
			</p>
			<button
				type="button"
				data-testid="delete-org"
				css={getPillButtonCss()}
				onClick={() => {
					setConfirmation('')
					dialog.current?.showModal()
				}}
			>
				Delete organization
			</button>
			<dialog
				ref={dialog}
				aria-labelledby="delete-org-title"
				data-testid="delete-org-dialog"
				onClick={(event) => {
					if (event.target === event.currentTarget) dialog.current?.close()
				}}
				css={{
					border: 0,
					borderRadius: '1rem',
					padding: '1.5rem',
					maxWidth: '28rem',
					'::backdrop': { background: 'rgb(0 0 0 / 0.5)' },
				}}
			>
				<h3 id="delete-org-title">Delete @{slug}?</h3>
				<p>
					Type <strong>{slug}</strong> or <strong>DELETE</strong> to confirm.
				</p>
				<OrgAction
					href={href}
					queryKey={queryKey}
					label="Delete organization"
					disabled={confirmation !== slug && confirmation !== 'DELETE'}
					onDone={onDone}
				>
					<label css={accountFieldCss}>
						<span css={accountFieldLabelCss}>Confirmation</span>
						<input
							css={accountInputCss}
							name="confirmation"
							autoComplete="off"
							required
							value={confirmation}
							onChange={(event) => setConfirmation(event.currentTarget.value)}
						/>
					</label>
					<button
						type="button"
						css={getPillButtonCss()}
						onClick={() => dialog.current?.close()}
					>
						Cancel
					</button>
				</OrgAction>
			</dialog>
		</>
	)
}

export function OrgSettingsPage({
	data,
	queryKey,
}: {
	data: OrgSettingsLoaderData
	queryKey: QueryKey
}) {
	const router = useRouter(),
		client = useQueryClient(),
		{ actorKey } = useRouteContext({ from: '__root__' }),
		args = { orgSlug: data.org.slug }
	const refreshShell = () => invalidateShellQueries(client, actorKey)
	return (
		<OrgShell title="Settings" slug={data.org.slug}>
			<AccountManagementPanel title={data.org.displayName || data.org.slug}>
				{data.org.personal ? (
					<p>
						Manage your personal organization in{' '}
						<SiteLink href="/account">Account</SiteLink>.
					</p>
				) : data.canManage ? (
					<>
						<OrgAction
							href={routes.orgSettingsPost.href(args)}
							queryKey={queryKey}
							label="Save name"
							onSaved={refreshShell}
						>
							<OrgField
								name="displayName"
								label="Display name"
								defaultValue={data.org.displayName ?? ''}
							/>
						</OrgAction>
						{data.org.avatarUrl ? (
							<img
								src={data.org.avatarUrl}
								alt="Organization avatar"
								width={80}
								height={80}
							/>
						) : null}
						<OrgAction
							href={routes.orgSettingsAvatarPost.href(args)}
							queryKey={queryKey}
							label="Upload avatar"
							onSaved={refreshShell}
							multipart
						>
							<label>
								Avatar
								<input type="file" name="avatar" accept="image/*" required />
							</label>
						</OrgAction>
						<OrgAction
							href={routes.orgSettingsAvatarPost.href(args)}
							queryKey={queryKey}
							label="Remove avatar"
							onSaved={refreshShell}
							confirm
						>
							<input type="hidden" name="remove" value="true" />
						</OrgAction>
					</>
				) : (
					<p>You do not have permission to change organization settings.</p>
				)}
			</AccountManagementPanel>
			{data.canDelete && !data.org.personal ? (
				<AccountManagementPanel title="Delete organization">
					<DeleteOrganization
						slug={data.org.slug}
						href={routes.orgSettingsDeletePost.href(args)}
						queryKey={queryKey}
						onDone={(href) => void router.navigate({ href })}
					/>
				</AccountManagementPanel>
			) : null}
		</OrgShell>
	)
}
export function OrgGrantsPage({
	data,
	queryKey,
}: {
	data: OrgGrantsLoaderData
	queryKey: QueryKey
}) {
	return (
		<OrgShell title="Grants" slug={data.org.slug}>
			<AccountManagementPanel title="Resource grants">
				{data.grants.length ? (
					data.grants.map((grant) => (
						<article key={grant.id}>
							<h3>{grant.resourceLabel}</h3>
							<p>
								{grant.subjectLabel} ·{' '}
								{grant.presetLabel || grant.permissions.join(', ')}
							</p>
							{data.canManage ? (
								<OrgAction
									href={routes.orgGrantsRevokePost.href({
										orgSlug: data.org.slug,
									})}
									queryKey={queryKey}
									label="Revoke grant"
									confirm
								>
									<input type="hidden" name="grantId" value={grant.id} />
								</OrgAction>
							) : null}
						</article>
					))
				) : (
					<p>No resource grants.</p>
				)}
			</AccountManagementPanel>
		</OrgShell>
	)
}
export function OrgCollaboratorsPage({
	data,
}: {
	data: OrgCollaboratorsLoaderData
	queryKey: QueryKey
}) {
	return (
		<OrgShell title="Collaborators" slug={data.org.slug}>
			<AccountManagementPanel title="Outside collaborators">
				{data.collaborators.length ? (
					data.collaborators.map((person) => (
						<article key={person.userId}>
							<h3>{person.displayName || person.username || person.userId}</h3>
							<ul>
								{person.grants.map((grant) => (
									<li key={grant.id}>
										{grant.resourceLabel}:{' '}
										{grant.presetLabel || grant.permissions.join(', ')}
									</li>
								))}
							</ul>
						</article>
					))
				) : (
					<p>No outside collaborators.</p>
				)}
				<SiteLink href={`/@${data.org.slug}/-/grants`}>
					Manage resource grants
				</SiteLink>
			</AccountManagementPanel>
		</OrgShell>
	)
}

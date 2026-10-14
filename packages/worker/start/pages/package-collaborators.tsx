/** @jsxImportSource @emotion/react */
import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CopyTextButton } from '../components/copy-text-button.tsx'
import { SiteLink } from '../components/site-link.tsx'
import { formatTimestampDate } from '../components/local-timestamp.tsx'
import { updatePackageCollaborators } from '#start/server/package-collaborators'
import { invalidatePageResources } from '../page-invalidation-cache.ts'
import { collaboratorsPageQuery } from '../package-collaborators-query.ts'
import {
	AccountManagementMessage,
	AccountManagementPanel,
	accountActionsCss,
	accountFieldCss,
	accountFieldLabelCss,
	accountFieldNoteCss,
	accountInputCss,
} from './account-management-components.tsx'
import { renderIcon } from '../components/icon.tsx'
import { resolvePackageListIconUrl } from '#universal/identity-icon-urls.ts'
import {
	type PackageCollaboratorPreset,
	type PackageCollaboratorsChange,
	type PackageCollaboratorsLoaderData,
	type PackageCollaboratorsView,
	type PackageCollaboratorView,
	packageCollaboratorPresetDescription,
	packageCollaboratorPresetLabel,
} from '#universal/package-collaborators.ts'
import {
	fallbackDefaultBranchName,
	getPackageTreeHref,
} from '#universal/package-files.ts'
import { renderPackageRepoChrome } from '../components/package-repo-nav.tsx'
import { routes } from '#universal/routes.ts'
import {
	getDangerPillCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { spacing } from '#universal/styles/tokens.ts'
import { UserAvatar } from '../components/user-avatar.tsx'
import { detailArticleCss } from '../components/community-detail-sections.tsx'
import {
	collaboratorDetail,
	collaboratorName,
	formCss,
	iconWellCss,
	inviteeName,
	listCss,
	mutedCopyCss,
	promptCss,
	readPreset,
	renderPresetOptions,
	rowActionsCss,
	rowCss,
	rowDetailCss,
	rowNameCss,
	rowTextCss,
	selectCss,
} from './package-collaborators-parts.tsx'

export function PackageCollaboratorsRoute({
	payload,
	actorKey,
}: {
	payload: Extract<PackageCollaboratorsLoaderData, { ok: true }>
	actorKey: string | null
}) {
	const client = useQueryClient()
	const { shell, view } = payload
	const { username, kodyId } = shell
	const page = { username, kodyId }
	const query = collaboratorsPageQuery(actorKey, page)
	const [confirmed, setConfirmed] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const [invitePrompt, setInvitePrompt] = useState<string | null>(null)
	const [teamId, setTeamId] = useState('')
	const [memberId, setMemberId] = useState('')
	const [invitee, setInvitee] = useState('')
	const [teamPreset, setTeamPreset] = useState<PackageCollaboratorPreset>('use')
	const [memberPreset, setMemberPreset] =
		useState<PackageCollaboratorPreset>('use')
	const [invitePreset, setInvitePreset] =
		useState<PackageCollaboratorPreset>('use')
	const inFlight = useRef(false)
	const mutation = useMutation({
		mutationKey: ['packageCollaborators', actorKey, username, kodyId],
		retry: false,
		gcTime: 0,
		mutationFn: async (input: {
			key: string
			change: PackageCollaboratorsChange
		}) =>
			updatePackageCollaborators({ data: { ...page, change: input.change } }),
		onMutate: () =>
			client.cancelQueries({ queryKey: query.queryKey, exact: true }),
		onSuccess: async (result) => {
			await client.cancelQueries({ queryKey: query.queryKey, exact: true })
			const { invite: _invite, ...accepted } = result
			client.setQueryData(query.queryKey, (old) =>
				old?.kind === 'page'
					? {
							...old,
							kind: 'page' as const,
							payload: { ...old.payload, view: accepted },
						}
					: old,
			)
		},
		onSettled: () => {
			void invalidatePageResources(client, actorKey, 'permissions')
		},
	})
	const busy = mutation.isPending ? mutation.variables.key : null
	async function postChange(
		key: string,
		change: PackageCollaboratorsChange,
		success: string,
	) {
		if (inFlight.current) return null
		inFlight.current = true
		setMessage(null)
		setInvitePrompt(null)
		try {
			const result = await mutation.mutateAsync({ key, change })
			setMessage(success)
			setMessageTone('info')
			return result
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : 'Kody could not save that.',
			)
			setMessageTone('error')
			return null
		} finally {
			inFlight.current = false
		}
	}
	async function changePreset(
		collaborator: PackageCollaboratorView,
		preset: PackageCollaboratorPreset,
		select: HTMLSelectElement,
	) {
		if (preset === collaborator.preset) return
		await postChange(
			`preset:${collaborator.grantId}`,
			{
				intent: 'grant',
				subjectType: collaborator.subjectType,
				subjectId: collaborator.subjectId,
				preset,
			},
			`${collaboratorName(collaborator)} can now ${packageCollaboratorPresetLabel(preset).toLowerCase()} this package.`,
		)
		void select
	}

	async function addTeam(
		event: FormEvent<HTMLFormElement>,
		view: PackageCollaboratorsView,
	) {
		event.preventDefault()
		const team = view.options.teams.find((option) => option.id === teamId)
		if (!team) return
		const accepted = await postChange(
			'add-team',
			{
				intent: 'grant',
				subjectType: 'team',
				subjectId: team.id,
				preset: teamPreset,
			},
			`Added ${team.name}.`,
		)
		if (accepted) setTeamId('')
	}

	async function addMember(
		event: FormEvent<HTMLFormElement>,
		view: PackageCollaboratorsView,
	) {
		event.preventDefault()
		const member = view.options.members.find(
			(option) => option.userId === memberId,
		)
		if (!member) return
		const accepted = await postChange(
			'add-member',
			{
				intent: 'grant',
				subjectType: 'user',
				subjectId: member.userId,
				preset: memberPreset,
			},
			`Added ${member.username ? `@${member.username}` : 'that member'}.`,
		)
		if (accepted) setMemberId('')
	}

	async function invite(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		const created = await postChange(
			'invite',
			{ intent: 'invite', invitee: invitee.trim(), preset: invitePreset },
			'Invite created. Send this prompt to them; it is shown only once.',
		)
		if (created?.invite) {
			setInvitee('')
			setInvitePrompt(created.invite.prompt)
		}
	}

	function renderCollaborator(collaborator: PackageCollaboratorView) {
		const checkKey = collaborator.grantId
		const name = collaboratorName(collaborator)
		return (
			<li
				key={collaborator.grantId}
				data-testid="package-collaborator"
				data-subject={collaborator.subjectId}
				css={rowCss}
			>
				{collaborator.subjectType === 'team' ? (
					<span aria-hidden="true" css={iconWellCss}>
						{renderIcon('users', { size: '1.25rem' })}
					</span>
				) : (
					<UserAvatar
						displayName={name}
						avatarUrl={collaborator.avatarUrl}
						size={44}
						variant="well"
					/>
				)}
				<span css={rowTextCss}>
					<span css={rowNameCss}>{name}</span>
					<span css={rowDetailCss}>{collaboratorDetail(collaborator)}</span>
				</span>
				<span css={rowActionsCss}>
					<select
						aria-label={`Access for ${name}`}
						value={collaborator.preset ?? ''}
						disabled={busy !== null}
						css={selectCss}
						onChange={(event) => {
							const preset = readPreset(event)
							if (!preset) return
							void changePreset(
								collaborator,
								preset,
								event.currentTarget as HTMLSelectElement,
							)
						}}
					>
						{collaborator.preset === null ? (
							<option value="" disabled>
								Custom ({collaborator.permissions.length} permissions)
							</option>
						) : null}
						{renderPresetOptions(collaborator.preset)}
					</select>
					<button
						type="button"
						disabled={busy !== null}
						css={getDangerPillCss({ size: 'sm' })}
						onBlur={() => setConfirmed(null)}
						onClick={() => {
							if (confirmed !== checkKey) {
								setConfirmed(checkKey)
								return
							}
							setConfirmed(null)
							void postChange(
								`revoke:${collaborator.grantId}`,
								{ intent: 'revoke', grantId: collaborator.grantId },
								`Removed ${name}.`,
							)
						}}
					>
						{renderIcon('user-cross', { size: '1.05rem' })}
						{confirmed === checkKey ? 'Confirm remove' : 'Remove'}
					</button>
				</span>
			</li>
		)
	}

	function renderPresetField(input: {
		label: string
		value: PackageCollaboratorPreset
		onChange: (preset: PackageCollaboratorPreset) => void
	}) {
		return (
			<label css={accountFieldCss}>
				<span css={accountFieldLabelCss}>Access</span>
				<select
					aria-label={input.label}
					value={input.value}
					css={selectCss}
					onChange={(event) => {
						const preset = readPreset(event)
						if (!preset) return
						input.onChange(preset)
					}}
				>
					{renderPresetOptions(input.value)}
				</select>
				<p css={accountFieldNoteCss}>
					{packageCollaboratorPresetDescription(input.value)}.
				</p>
			</label>
		)
	}

	function renderAddTeam(view: PackageCollaboratorsView) {
		const teamsHref = routes.orgTeams.href({ orgSlug: view.org.slug })
		return (
			<AccountManagementPanel title="Add a team">
				{view.options.teams.length === 0 ? (
					<p css={mutedCopyCss}>
						Every team in this organization already has access, or there are no
						teams yet. <SiteLink href={teamsHref}>Manage teams</SiteLink>.
					</p>
				) : (
					<form
						data-testid="package-collaborators-add-team"
						css={formCss}
						onSubmit={(event) => void addTeam(event, view)}
					>
						<label css={accountFieldCss}>
							<span css={accountFieldLabelCss}>Team</span>
							<select
								aria-label="Team"
								value={teamId}
								required
								css={selectCss}
								onChange={(event) => {
									setTeamId((event.currentTarget as HTMLSelectElement).value)
								}}
							>
								<option value="">Choose a team</option>
								{view.options.teams.map((team) => (
									<option key={team.id} value={team.id}>
										{team.name} ({team.memberCount}{' '}
										{team.memberCount === 1 ? 'member' : 'members'})
									</option>
								))}
							</select>
						</label>
						{renderPresetField({
							label: 'Access for the team',
							value: teamPreset,
							onChange: (preset) => {
								setTeamPreset(preset)
							},
						})}
						<div css={accountActionsCss}>
							<button
								type="submit"
								disabled={busy !== null || teamId === ''}
								css={getPillButtonCss({ size: 'sm' })}
							>
								{renderIcon('plus', { size: '1.05rem' })}
								{busy === 'add-team' ? 'Adding…' : 'Add team'}
							</button>
						</div>
					</form>
				)}
			</AccountManagementPanel>
		)
	}

	function renderAddMember(view: PackageCollaboratorsView) {
		return (
			<AccountManagementPanel title="Add an org member">
				{view.options.members.length === 0 ? (
					<p css={mutedCopyCss}>
						No members left to add. Owners already have full access.
					</p>
				) : (
					<form
						data-testid="package-collaborators-add-member"
						css={formCss}
						onSubmit={(event) => void addMember(event, view)}
					>
						<label css={accountFieldCss}>
							<span css={accountFieldLabelCss}>Member</span>
							<select
								aria-label="Member"
								value={memberId}
								required
								css={selectCss}
								onChange={(event) => {
									setMemberId((event.currentTarget as HTMLSelectElement).value)
								}}
							>
								<option value="">Choose a member</option>
								{view.options.members.map((member) => (
									<option key={member.userId} value={member.userId}>
										{member.username ? `@${member.username}` : member.userId}
										{member.displayName ? ` (${member.displayName})` : ''}
									</option>
								))}
							</select>
						</label>
						{renderPresetField({
							label: 'Access for the member',
							value: memberPreset,
							onChange: (preset) => {
								setMemberPreset(preset)
							},
						})}
						<div css={accountActionsCss}>
							<button
								type="submit"
								disabled={busy !== null || memberId === ''}
								css={getPillButtonCss({ size: 'sm' })}
							>
								{renderIcon('plus', { size: '1.05rem' })}
								{busy === 'add-member' ? 'Adding…' : 'Add member'}
							</button>
						</div>
					</form>
				)}
			</AccountManagementPanel>
		)
	}

	function renderInvite(view: PackageCollaboratorsView) {
		return (
			<AccountManagementPanel
				title={
					view.org.personal
						? 'Invite a collaborator'
						: 'Invite someone outside the organization'
				}
				description="They get access to this package only, not to the rest of the organization or its credentials."
			>
				<form
					data-testid="package-collaborators-invite"
					css={formCss}
					onSubmit={(event) => void invite(event)}
				>
					<label css={accountFieldCss}>
						<span css={accountFieldLabelCss}>Email or username</span>
						<input
							value={invitee}
							required
							data-field-ring
							autoComplete="off"
							css={accountInputCss}
							onInput={(event) => {
								setInvitee((event.currentTarget as HTMLInputElement).value)
							}}
						/>
						<p css={accountFieldNoteCss}>
							They accept by pasting the invite prompt into their agent.
						</p>
					</label>
					{renderPresetField({
						label: 'Access for the invitee',
						value: invitePreset,
						onChange: (preset) => {
							setInvitePreset(preset)
						},
					})}
					<div css={accountActionsCss}>
						<button
							type="submit"
							disabled={busy !== null || invitee.trim().length === 0}
							css={getPillButtonCss({ size: 'sm' })}
						>
							{renderIcon('mail', { size: '1.05rem' })}
							{busy === 'invite' ? 'Inviting…' : 'Create invite'}
						</button>
					</div>
				</form>
				{invitePrompt ? (
					<div css={{ display: 'grid', gap: spacing.sm }}>
						<pre css={promptCss} data-testid="package-collaborators-prompt">
							{invitePrompt}
						</pre>
						<CopyTextButton
							value={invitePrompt}
							idleLabel="Copy invite prompt"
						/>
					</div>
				) : null}
			</AccountManagementPanel>
		)
	}

	function renderInvites(view: PackageCollaboratorsView) {
		if (view.invites.length === 0) return null
		return (
			<AccountManagementPanel title="Pending invites">
				<ul css={listCss} data-testid="package-collaborator-invites">
					{view.invites.map((pendingInvite) => {
						const checkKey = `invite:${pendingInvite.id}`
						const name = inviteeName(pendingInvite)
						return (
							<li
								key={pendingInvite.id}
								data-testid="package-collaborator-invite"
								css={rowCss}
							>
								<span aria-hidden="true" css={iconWellCss}>
									{renderIcon('mail', { size: '1.25rem' })}
								</span>
								<span css={rowTextCss}>
									<span css={rowNameCss}>{name}</span>
									<span css={rowDetailCss}>
										{pendingInvite.preset
											? packageCollaboratorPresetLabel(pendingInvite.preset)
											: 'Custom access'}
										{' · Expires '}
										{formatTimestampDate(pendingInvite.expiresAt)}
									</span>
								</span>
								<span css={rowActionsCss}>
									<button
										type="button"
										disabled={busy !== null}
										css={getDangerPillCss({ size: 'sm' })}
										onBlur={() => setConfirmed(null)}
										onClick={() => {
											if (confirmed !== checkKey) {
												setConfirmed(checkKey)
												return
											}
											setConfirmed(null)
											void postChange(
												`revoke-invite:${pendingInvite.id}`,
												{
													intent: 'revoke-invite',
													inviteId: pendingInvite.id,
												},
												`Revoked the invite for ${name}.`,
											)
										}}
									>
										{renderIcon('close', { size: '1.05rem' })}
										{confirmed === checkKey ? 'Confirm revoke' : 'Revoke'}
									</button>
								</span>
							</li>
						)
					})}
				</ul>
			</AccountManagementPanel>
		)
	}
	return (
		<article
			css={detailArticleCss}
			data-testid="package-collaborators"
			aria-busy={mutation.isPending || undefined}
		>
			{renderPackageRepoChrome({
				username,
				kodyId,
				isPrivate: shell?.isPrivate ?? false,
				isListed: shell?.isListed ?? false,
				viewerIsOwner: true,
				viewerCanManage: shell?.viewerCanManage ?? false,
				viewerCanManageAccess: true,
				active: 'collaborators',
				filesHref: getPackageTreeHref({
					username,
					kodyId,
					listingId: shell?.listingId ?? null,
					ref: shell?.defaultBranch || fallbackDefaultBranchName,
				}),
				description: shell?.description ?? '',
				ownerProfilePublic: shell?.ownerProfilePublic ?? true,
				iconUrl: resolvePackageListIconUrl({
					username,
					kodyId,
					listingId: shell?.listingId ?? null,
					listingIconCommit: null,
					publishedCommit: shell?.publishedCommit ?? null,
				}),
				iconName: kodyId,
			})}

			{message ? (
				<AccountManagementMessage tone={messageTone}>
					{message}
				</AccountManagementMessage>
			) : null}
			{view ? (
				<>
					<AccountManagementPanel
						title="Who has access"
						description={
							view.org.personal
								? 'You always have full access to your own packages.'
								: 'Organization owners always have full access.'
						}
					>
						{view.collaborators.length === 0 ? (
							<p css={mutedCopyCss} data-testid="package-collaborators-empty">
								Nobody else has been given access to this package yet.
							</p>
						) : (
							<ul css={listCss} data-testid="package-collaborators-list">
								{view.collaborators.map(renderCollaborator)}
							</ul>
						)}
					</AccountManagementPanel>
					{view.org.personal ? null : renderAddTeam(view)}
					{view.org.personal ? null : renderAddMember(view)}
					{renderInvite(view)}
					{renderInvites(view)}
				</>
			) : null}
		</article>
	)
}

/** @jsxImportSource @emotion/react */
import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
	loadPackageInviteLinks,
	createPackageInviteLink,
	revokePackageInviteLink,
} from '#start/server/invite-links'
import { useSubmitterScope } from '../use-submitter-scope.ts'

import { formatTimestampDate } from '../components/local-timestamp.tsx'
import {
	AccountManagementPanel,
	accountActionsCss,
	accountFieldCss,
	accountFieldLabelCss,
	accountFieldNoteCss,
	accountInputCss,
} from './account-management-components.tsx'
import { renderIcon } from '../components/icon.tsx'
import { type ScopedInviteLinkView } from '#universal/loader-data.ts'
import {
	type PackageCollaboratorPreset,
	packageCollaboratorPresetDescription,
} from '#universal/package-collaborators.ts'

import {
	getDangerPillCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	formCss,
	iconWellCss,
	listCss,
	mutedCopyCss,
	readPreset,
	renderPresetOptions,
	rowActionsCss,
	rowCss,
	rowDetailCss,
	rowNameCss,
	rowTextCss,
	selectCss,
} from './package-collaborators-parts.tsx'

type CreatedLink = { id: string; url: string }

function creatorLabel(link: ScopedInviteLinkView) {
	if (link.createdByDisplayName?.trim()) return link.createdByDisplayName.trim()
	if (link.createdByUsername) return `@${link.createdByUsername}`
	return 'Someone'
}

async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		return false
	}
}

/**
 * Create, list, and revoke links that give one package's access to whoever
 * accepts. Works for personal and team orgs alike; the recipient becomes an
 * outside collaborator unless they already belong to the org.
 */
export function PackageInviteLinksPanel(props: {
	username: string
	kodyId: string
	orgSlug: string
	personal: boolean
	actorKey: string | null
}) {
	return (
		<PackageInviteLinksContent
			key={JSON.stringify([props.actorKey, props.username, props.kodyId])}
			{...props}
		/>
	)
}
function PackageInviteLinksContent({
	username,
	kodyId,
	orgSlug,
	personal,
	actorKey,
}: {
	username: string
	kodyId: string
	orgSlug: string
	personal: boolean
	actorKey: string | null
}) {
	const client = useQueryClient()
	const capture = useSubmitterScope()
	const page = { username, kodyId }
	const queryKey = ['packageInviteLinks', actorKey, page] as const
	const query = useQuery({
		queryKey,
		queryFn: async () => {
			const result = await loadPackageInviteLinks({ data: page })
			return result.links
		},
		staleTime: 0,
		retry: false,
	})
	const links = query.data ?? []
	const loadError = query.error?.message
	const [preset, setPreset] = useState<PackageCollaboratorPreset>('use')
	const [maxUses, setMaxUses] = useState('1')
	const [expiresInDays, setExpiresInDays] = useState('7')
	const [created, setCreated] = useState<CreatedLink | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [messageTone, setMessageTone] = useState<'info' | 'error'>('info')
	const createdUrl = created?.url
	type Action =
		| {
				action: 'create'
				preset: PackageCollaboratorPreset
				maxUses: string | null
				expiresInDays: string
		  }
		| { action: 'revoke'; linkId: string }
	const mutation = useMutation({
		retry: false,
		gcTime: 0,
		mutationFn: async (input: Action) => {
			const result =
				input.action === 'create'
					? await createPackageInviteLink({ data: { ...page, ...input } })
					: await revokePackageInviteLink({
							data: { ...page, linkId: input.linkId },
						})
			return result
		},
		onMutate: async () => {
			await client.cancelQueries({ queryKey })
			return { queryKey }
		},
		onSettled: async (_result, _error, _input, context) => {
			if (!context) return
			await client.cancelQueries({
				queryKey: context.queryKey,
				exact: true,
				predicate: (query) => query.state.data !== undefined,
			})
			await client.invalidateQueries({
				queryKey: context.queryKey,
				exact: true,
			})
		},
	})
	const busy = mutation.isPending
		? mutation.variables?.action === 'create'
			? 'create'
			: `revoke:${mutation.variables?.linkId}`
		: null
	function act(input: Action) {
		const active = capture()
		setMessage(null)
		mutation.mutate(input, {
			onSuccess: async (result) => {
				if (!active()) return
				if (
					input.action === 'create' &&
					'inviteLink' in result &&
					result.inviteLink
				) {
					const link = result.inviteLink
					setCreated(link)
					const copied = await copyText(link.url)
					if (!active()) return
					setMessage(
						copied
							? 'Invite link copied to clipboard.'
							: 'Invite link created. Copy it below; it is shown only once.',
					)
				} else {
					if (input.action === 'revoke' && created?.id === input.linkId)
						setCreated(null)
					setMessage('Invite link revoked.')
				}
				setMessageTone('info')
			},
			onError: (error) => {
				if (active()) {
					setMessage(error.message)
					setMessageTone('error')
				}
			},
		})
	}
	function create(event: FormEvent) {
		event.preventDefault()
		if (!busy)
			act({
				action: 'create',
				preset,
				maxUses: maxUses.trim() || null,
				expiresInDays: expiresInDays.trim() || '7',
			})
	}
	function revoke(linkId: string) {
		if (!busy) act({ action: 'revoke', linkId })
	}
	async function copyAgain() {
		if (!createdUrl) return
		const active = capture()
		const copied = await copyText(createdUrl)
		if (active()) {
			setMessage(
				copied
					? 'Invite link copied to clipboard.'
					: 'Could not copy the link. Select it manually.',
			)
			setMessageTone(copied ? 'info' : 'error')
		}
	}

	function renderLink(link: ScopedInviteLinkView) {
		return (
			<li key={link.id} css={rowCss} data-testid="package-invite-link">
				<span aria-hidden="true" css={iconWellCss}>
					{renderIcon('link', { size: '1.25rem' })}
				</span>
				<span css={rowTextCss}>
					<span css={rowNameCss}>{link.label} link</span>
					<span css={rowDetailCss}>
						{[
							`${link.useCount}${link.maxUses != null ? ` / ${link.maxUses}` : ''} uses`,
							`Expires ${formatTimestampDate(link.expiresAt)}`,
							`Created by ${creatorLabel(link)}`,
						].join(' · ')}
					</span>
				</span>
				<span css={rowActionsCss}>
					<button
						type="button"
						disabled={busy !== null}
						css={getDangerPillCss({ size: 'sm' })}
						onClick={() => revoke(link.id)}
					>
						{busy === `revoke:${link.id}` ? 'Revoking…' : 'Revoke'}
					</button>
				</span>
			</li>
		)
	}

	return (
		<AccountManagementPanel
			title="Share with a link"
			description={
				personal
					? 'Anyone who accepts the link gets this access to the package as an outside collaborator.'
					: `Anyone who accepts the link gets this access to the package. People who are not members of @${orgSlug} become outside collaborators; the link never adds anyone to the organization.`
			}
		>
			<form
				data-testid="package-invite-link-form"
				css={formCss}
				onSubmit={create}
			>
				<label css={accountFieldCss}>
					<span css={accountFieldLabelCss}>Access</span>
					<select
						aria-label="Access for the invite link"
						value={preset}
						css={selectCss}
						onChange={(event) => {
							const next = readPreset(event)
							if (next) setPreset(next)
						}}
					>
						{renderPresetOptions(preset)}
					</select>
					<p css={accountFieldNoteCss}>
						{packageCollaboratorPresetDescription(preset)}.
					</p>
				</label>
				<label css={accountFieldCss}>
					<span css={accountFieldLabelCss}>Max uses</span>
					<input
						value={maxUses}
						data-field-ring
						inputMode="numeric"
						autoComplete="off"
						placeholder="Unlimited"
						aria-label="Max uses"
						css={accountInputCss}
						onChange={(event) => setMaxUses(event.currentTarget.value)}
					/>
					<p css={accountFieldNoteCss}>
						One person per use. Leave blank to let anyone with the link accept.
					</p>
				</label>
				<label css={accountFieldCss}>
					<span css={accountFieldLabelCss}>Expires in days</span>
					<input
						value={expiresInDays}
						data-field-ring
						inputMode="numeric"
						autoComplete="off"
						aria-label="Expires in days"
						css={accountInputCss}
						onChange={(event) => setExpiresInDays(event.currentTarget.value)}
					/>
				</label>
				<div css={accountActionsCss}>
					<button
						type="submit"
						disabled={busy !== null}
						data-testid="package-invite-link-create"
						css={getPillButtonCss({ size: 'sm' })}
					>
						{renderIcon('link', { size: '1.05rem' })}
						{busy === 'create' ? 'Creating…' : 'Create invite link'}
					</button>
				</div>
			</form>
			{message ? (
				<p
					role={messageTone === 'error' ? 'alert' : 'status'}
					css={messageTone === 'error' ? errorCss : statusCss}
				>
					{message}
				</p>
			) : null}
			{createdUrl ? (
				<div css={createdCss} data-testid="package-invite-link-url">
					<code css={createdCodeCss}>{createdUrl}</code>
					<button
						type="button"
						css={getPillButtonCss({ size: 'sm' })}
						onClick={() => void copyAgain()}
					>
						{renderIcon('copy', { size: '1.05rem' })}
						Copy again
					</button>
				</div>
			) : null}
			{loadError ? (
				<p role="alert" css={errorCss}>
					{loadError}
				</p>
			) : query.isPending ? (
				<p role="status" css={linksEmptyCss}>
					Loading invite links…
				</p>
			) : links.length > 0 ? (
				<ul css={linksListCss} data-testid="package-invite-links">
					{links.map(renderLink)}
				</ul>
			) : (
				<p css={linksEmptyCss}>No active invite links.</p>
			)}
		</AccountManagementPanel>
	)
}

const statusCss = {
	margin: `${spacing.md} 0 0`,
	color: colors.text,
}

const errorCss = {
	margin: `${spacing.md} 0 0`,
	color: colors.danger,
}

const createdCss = {
	display: 'grid',
	gap: spacing.sm,
	marginTop: spacing.lg,
	padding: spacing.md,
	borderRadius: radius.card,
	border: `1.5px solid ${colors.border}`,
	backgroundColor: colors.background,
}

const createdCodeCss = {
	fontSize: typography.fontSize.sm,
	overflowWrap: 'anywhere' as const,
	color: colors.text,
}

const linksListCss = {
	...listCss,
	marginTop: spacing.lg,
}

const linksEmptyCss = {
	...mutedCopyCss,
	marginTop: spacing.lg,
}

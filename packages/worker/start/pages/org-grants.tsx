/** @jsxImportSource @emotion/react */
import { type QueryKey } from '@tanstack/react-query'
import {
	AccountManagementPanel,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import { SiteLink } from '../components/site-link.tsx'
import {
	colors,
	radius,
	spacing,
	typography,
} from '#universal/styles/tokens.ts'
import {
	type OrgGrantsLoaderData,
	type OrgGrantView,
} from '#universal/loader-data.ts'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { orgCollaboratorsPath, orgTeamsPath } from '#universal/org-pages.ts'
import { routes } from '#universal/routes.ts'
import { getDangerPillCss } from '#universal/styles/style-primitives.ts'
import { renderIcon } from '../components/icon.tsx'
import { AccountManagementMessage } from './account-management-components.tsx'
function grantSummary(grant: OrgGrantView) {
	const access = grant.presetLabel ?? 'Custom permissions'
	return `${grant.subjectLabel} · ${access} on ${grant.resourceLabel}`
}

export function OrgGrantsPage(props: {
	data: OrgGrantsLoaderData
	queryKey: QueryKey
}) {
	return <OrgGrantsContent key={JSON.stringify(props.queryKey)} {...props} />
}

function OrgGrantsContent({
	data,
	queryKey,
}: {
	data: OrgGrantsLoaderData
	queryKey: QueryKey
}) {
	const client = useQueryClient()
	const capture = useSubmitterScope()
	const [armed, setArmed] = useState<string | null>(null)
	const [message, setMessage] = useState<{
		tone: 'info' | 'error'
		text: string
	} | null>(null)
	const mutation = useMutation({
		mutationFn: async (input: {
			grantId: string
			slug: string
			queryKey: QueryKey
		}) => {
			const response = await fetch(
				routes.orgGrantsRevokePost.href({ orgSlug: input.slug }),
				{
					method: 'POST',
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ grantId: input.grantId }),
				},
			)
			const payload = (await response.json().catch(() => null)) as {
				ok?: boolean
				error?: string
			} | null
			if (!response.ok || !payload?.ok)
				throw new Error(
					response.status === 401
						? 'Sign in again to continue.'
						: payload?.error || 'Unable to revoke that grant.',
				)
		},
		onSuccess: async (_, input) => {
			await client.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === input.queryKey[0] &&
					query.queryKey[1] === input.queryKey[1] &&
					typeof query.queryKey[3] === 'object' &&
					query.queryKey[3] !== null &&
					'slug' in query.queryKey[3] &&
					query.queryKey[3].slug === input.slug,
			})
		},
	})
	return (
		<AccountManagementShell currentHref={`/@${data.org.slug}/-/grants`}>
			<AccountPageHeader
				title="Grants"
				description="Who can use packages and other resources in this organization."
				currentHref={`/@${data.org.slug}/-/grants`}
			/>
			{message ? (
				<AccountManagementMessage tone={message.tone}>
					{message.text}
				</AccountManagementMessage>
			) : null}
			{data?.ok ? (
				<AccountManagementPanel
					title="Access grants"
					ariaLabel="Organization grants"
				>
					{data.grants.length === 0 ? (
						<p css={mutedCopyCss} data-testid="org-grants-empty">
							No grants yet. Grant access with{' '}
							<code css={codeCss}>accessGrant</code> or invite someone to a
							package. Outside collaborators appear on{' '}
							<SiteLink href={orgCollaboratorsPath(data.org.slug)}>
								Collaborators
							</SiteLink>
							{data.org.role === 'owner' || data.org.role === 'member' ? (
								<>
									; team subjects are managed under{' '}
									<SiteLink href={orgTeamsPath(data.org.slug)}>Teams</SiteLink>
								</>
							) : null}
							.
						</p>
					) : (
						<ul css={listCss} data-testid="org-grants">
							{data.grants.map((grant) => {
								const confirmed = armed === grant.id
								return (
									<li
										key={grant.id}
										data-testid="org-grant"
										data-grant-id={grant.id}
										css={rowItemCss}
									>
										<div css={rowCss}>
											<span aria-hidden="true" css={iconCss}>
												{renderIcon(
													grant.subjectType === 'team' ? 'users' : 'user',
													{ size: '1.25rem' },
												)}
											</span>
											<span css={rowTextCss}>
												<span css={rowNameCss}>{grantSummary(grant)}</span>
												<span css={rowDetailCss}>
													{grant.resourceType}
													{grant.preset
														? ''
														: ` · ${grant.permissions.join(', ') || 'no permissions'}`}
												</span>
											</span>
											{data.canManage && grant.canRevoke ? (
												<button
													type="button"
													data-testid="org-grant-revoke"
													css={getDangerPillCss({ size: 'sm' })}
													disabled={mutation.isPending}
													onBlur={() => setArmed(null)}
													onKeyDown={(event) => {
														if (event.key === 'Escape') setArmed(null)
													}}
													onClick={() => {
														if (!confirmed) {
															setArmed(grant.id)
															return
														}
														const isCurrent = capture()
														setMessage(null)
														mutation.mutate(
															{
																grantId: grant.id,
																slug: data.org.slug,
																queryKey,
															},
															{
																onSuccess: () => {
																	if (isCurrent()) {
																		setArmed(null)
																		setMessage({
																			tone: 'info',
																			text: 'Grant revoked.',
																		})
																	}
																},
																onError: (error) => {
																	if (isCurrent())
																		setMessage({
																			tone: 'error',
																			text: error.message,
																		})
																},
															},
														)
													}}
												>
													{renderIcon('close', { size: '1.05rem' })}
													{confirmed ? 'Confirm revoke' : 'Revoke'}
												</button>
											) : null}
										</div>
									</li>
								)
							})}
						</ul>
					)}
				</AccountManagementPanel>
			) : null}
		</AccountManagementShell>
	)
}
const mutedCopyCss = {
	margin: 0,
	color: colors.textMuted,
	lineHeight: 1.5,
}

const codeCss = {
	fontSize: '0.9em',
}

const listCss = {
	listStyle: 'none',
	margin: 0,
	padding: 0,
	display: 'grid',
	gap: spacing.sm,
}

const rowItemCss = {
	minWidth: 0,
}

const rowCss = {
	display: 'flex',
	alignItems: 'center',
	gap: spacing.md,
	minWidth: 0,
	padding: '0.85rem 1rem',
	borderRadius: radius.card,
	border: `1.5px solid ${colors.border}`,
	backgroundColor: colors.surface,
}

const rowTextCss = {
	display: 'grid',
	gap: '0.15rem',
	minWidth: 0,
	flex: '1 1 auto',
}

const rowNameCss = {
	fontWeight: 650,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap' as const,
}

const rowDetailCss = {
	fontSize: typography.fontSize.sm,
	color: colors.textMuted,
}

const iconCss = {
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
	width: '2.75rem',
	height: '2.75rem',
	borderRadius: radius.full,
	color: colors.textMuted,
	backgroundColor: colors.background,
	flexShrink: 0,
}

/** @jsxImportSource @emotion/react */
import { type CSSObject } from '@emotion/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouteContext } from '@tanstack/react-router'
import { z } from 'zod'
import { ErrorAgentPromptButton } from '../components/error-agent-prompt-button.tsx'
import { buildErrorAgentPrompt } from '#universal/error-agent-prompt.ts'
import { renderIcon } from '../components/icon.tsx'
import { UserAvatar } from '../components/user-avatar.tsx'
import { SiteLink } from '../components/site-link.tsx'
import { type OrgInviteJoinLoaderData } from '#universal/loader-data.ts'
import { routes } from '#universal/routes.ts'
import {
	cardCss,
	getPrimaryButtonCss,
	getSecondaryButtonCss,
	mutedLinkCss,
	pageDescriptionCss,
	pageHeaderCss,
	pageTitleCss,
	stackedPageCss,
} from '#universal/styles/style-primitives.ts'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import { invalidateShellQueries } from '../shell-query.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'

const resultSchema = z.object({
	ok: z.boolean(),
	error: z.string().optional(),
	alreadyMember: z.boolean().optional(),
	redirectTo: z.string().optional(),
})
function inviteErrorPrompt(error: string, slug?: string) {
	return buildErrorAgentPrompt({
		activity: slug
			? 'Joining an organization from an invite link.'
			: 'Opening an organization invite link.',
		errorCode: slug ? 'org_invite_join_failed' : 'org_invite_unusable',
		errorMessage: error,
		ids: { path: '/join', ...(slug ? { orgSlug: slug } : {}) },
		likelyCause: slug
			? 'The invite could not be accepted (expired, already used, or permission issue).'
			: 'The invite expired, was revoked, or the token is invalid.',
		nextSteps: [
			'Ask the org owner to send a fresh invite.',
			'Confirm I am signed in as the invited email.',
		],
		kodyTools: ['search({ entity: "guide:organizations" })'],
		docs: ['search({ entity: "guide:organizations" })'],
	})
}
export function OrgInviteJoinPage({ data }: { data: OrgInviteJoinLoaderData }) {
	const router = useRouter(),
		client = useQueryClient(),
		capture = useSubmitterScope()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const mutation = useMutation({
		mutationFn: async ({
			token,
		}: {
			token: string
			actorKey: string | null
		}) => {
			const response = await fetch(routes.orgInviteJoinPost.href({ token }), {
				method: 'POST',
				headers: { Accept: 'application/json' },
				credentials: 'include',
				redirect: 'manual',
			})
			if (response.status === 401 || response.type === 'opaqueredirect')
				return { needsLogin: true, alreadyMember: false, redirectTo: '/' }
			const result = resultSchema.safeParse(
				await response.json().catch(() => null),
			)
			if (!response.ok || !result.success || !result.data.ok)
				throw new Error(
					result.success
						? (result.data.error ?? 'Unable to join this organization.')
						: 'Unable to join this organization.',
				)
			return {
				needsLogin: false,
				alreadyMember: result.data.alreadyMember === true,
				redirectTo: result.data.redirectTo || '/',
			}
		},
		onSuccess: async (result, variables) => {
			if (!result.needsLogin)
				await invalidateShellQueries(client, variables.actorKey)
		},
	})
	if (!data.ok)
		return (
			<section css={pageCss}>
				<header css={pageHeaderCss}>
					<h1 css={pageTitleCss}>Invite link</h1>
					<p css={pageDescriptionCss}>This invite link cannot be used.</p>
				</header>
				<div css={cardCss}>
					<p role="alert" css={bodyCss}>
						{data.error}
					</p>
					<ErrorAgentPromptButton prompt={inviteErrorPrompt(data.error)} />
					<p css={footerCss}>
						<SiteLink href="/" css={mutedLinkCss}>
							Go home
						</SiteLink>
					</p>
				</div>
			</section>
		)
	const name = data.org.displayName?.trim() || data.org.slug
	const loginHref = `/login?redirectTo=${encodeURIComponent(routes.orgInviteJoin.href({ token: data.token }))}`,
		signupHref = `/signup?redirectTo=${encodeURIComponent(routes.orgInviteJoin.href({ token: data.token }))}`
	const message =
		mutation.error?.message ??
		(mutation.isSuccess && !mutation.data.needsLogin
			? mutation.data.alreadyMember
				? 'You are already a member of this organization.'
				: 'You joined the organization.'
			: null)
	return (
		<section css={pageCss} data-testid="org-invite-join">
			<header css={pageHeaderCss}>
				<h1 css={pageTitleCss}>Join {name}</h1>
				<p css={pageDescriptionCss}>
					{data.alreadyMember
						? `You already belong to ${name}.`
						: `You are invited to join ${name} as ${data.roleLabel}.`}
				</p>
			</header>
			<div css={cardCss}>
				<div css={orgRowCss}>
					<UserAvatar
						displayName={name}
						avatarUrl={data.org.avatarUrl}
						size={56}
						variant="well"
					/>
					<div css={orgTextCss}>
						<p css={orgNameCss}>{name}</p>
						<p css={orgDetailCss}>@{data.org.slug}</p>
					</div>
				</div>
				{message ? (
					<>
						<p
							role={mutation.error ? 'alert' : 'status'}
							css={mutation.error ? errorMessageCss : infoMessageCss}
						>
							{message}
						</p>
						{mutation.error ? (
							<ErrorAgentPromptButton
								prompt={inviteErrorPrompt(message, data.org.slug)}
							/>
						) : null}
					</>
				) : null}
				{data.alreadyMember ? (
					<p css={footerCss}>
						<SiteLink href={`/@${data.org.slug}`} css={getPrimaryButtonCss()}>
							Open {name}
						</SiteLink>
					</p>
				) : data.authenticated ? (
					<div css={actionsCss}>
						<button
							type="button"
							disabled={mutation.isPending || mutation.isSuccess}
							data-testid="org-invite-join-confirm"
							css={getPrimaryButtonCss()}
							onClick={() => {
								const active = capture()
								mutation.mutate(
									{ token: data.token, actorKey },
									{
										onSuccess: (result) => {
											if (active())
												void router.navigate({
													href: result.needsLogin
														? loginHref
														: result.redirectTo,
												})
										},
									},
								)
							}}
						>
							{renderIcon('plus', { size: '1.05rem' })}
							{mutation.isPending ? 'Joining…' : `Join ${name}`}
						</button>
					</div>
				) : (
					<div css={actionsCss}>
						<SiteLink href={loginHref} css={getPrimaryButtonCss()}>
							Sign in to join
						</SiteLink>
						<SiteLink href={signupHref} css={getSecondaryButtonCss()}>
							Create an account
						</SiteLink>
					</div>
				)}
			</div>
		</section>
	)
}
const pageCss: CSSObject = {
	...stackedPageCss,
	maxWidth: '36rem',
}

const bodyCss: CSSObject = {
	margin: 0,
	color: colors.text,
	fontSize: typography.fontSize.base,
	lineHeight: 1.5,
}

const footerCss: CSSObject = {
	margin: `${spacing.lg} 0 0`,
}

const orgRowCss: CSSObject = {
	display: 'flex',
	alignItems: 'center',
	gap: spacing.md,
	marginBottom: spacing.lg,
}

const orgTextCss: CSSObject = {
	display: 'grid',
	gap: '0.2rem',
	minWidth: 0,
}

const orgNameCss: CSSObject = {
	margin: 0,
	fontWeight: 650,
	fontSize: typography.fontSize.lg,
}

const orgDetailCss: CSSObject = {
	margin: 0,
	color: colors.textMuted,
	fontSize: typography.fontSize.sm,
}

const actionsCss: CSSObject = {
	display: 'flex',
	flexWrap: 'wrap' as const,
	gap: spacing.sm,
	alignItems: 'center',
}

const infoMessageCss: CSSObject = {
	margin: `0 0 ${spacing.md}`,
	color: colors.text,
}

const errorMessageCss: CSSObject = {
	margin: `0 0 ${spacing.md}`,
	color: colors.danger,
}

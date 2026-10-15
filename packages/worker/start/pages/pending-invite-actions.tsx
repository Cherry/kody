/** @jsxImportSource @emotion/react */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouteContext } from '@tanstack/react-router'
import { updatePendingInvite } from '#start/server/account-invites'
import { type AccountPendingInvite } from '#universal/loader-data.ts'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { spacing } from '#universal/styles/tokens.ts'
import { invalidateShellQueries } from '../shell-query.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'

type PendingInviteRef = Pick<AccountPendingInvite, 'source' | 'id'>
export function usePendingInviteActions() {
	const client = useQueryClient()
	const router = useRouter()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const capture = useSubmitterScope()
	const mutation = useMutation({
		mutationFn: ({
			invite,
			action,
		}: {
			invite: PendingInviteRef
			action: 'accept' | 'decline'
			actorKey: string | null
		}) => updatePendingInvite({ data: { ...invite, action } }),
		onMutate: async (variables) => {
			await client.cancelQueries({ queryKey: ['page', variables.actorKey] })
		},
		onSettled: async (_result, _error, variables) => {
			// Accepting can change organization membership and grants across cached pages.
			await Promise.all([
				client.invalidateQueries({ queryKey: ['page', variables.actorKey] }),
				invalidateShellQueries(client, variables.actorKey),
			])
		},
	})
	function run(invite: PendingInviteRef, action: 'accept' | 'decline') {
		if (mutation.isPending) return
		const active = capture()
		mutation.mutate(
			{ invite, action, actorKey },
			{
				onSuccess: (result) => {
					if (active() && action === 'accept' && result.redirectTo)
						void router.navigate({ href: result.redirectTo })
				},
			},
		)
	}
	return {
		busyKey: mutation.isPending
			? `${mutation.variables.invite.source}:${mutation.variables.invite.id}`
			: null,
		message:
			mutation.error?.message ??
			(mutation.isSuccess
				? mutation.variables.action === 'accept'
					? 'Invite accepted.'
					: 'Invite declined.'
				: null),
		tone: mutation.isError ? ('error' as const) : ('info' as const),
		accept: (invite: PendingInviteRef) => run(invite, 'accept'),
		decline: (invite: PendingInviteRef) => run(invite, 'decline'),
	}
}
export type PendingInviteActions = ReturnType<typeof usePendingInviteActions>
export function renderPendingInviteActions(
	invite: PendingInviteRef,
	actions: PendingInviteActions,
) {
	const busy = actions.busyKey === `${invite.source}:${invite.id}`
	return (
		<span
			css={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: spacing.sm,
				flexShrink: 0,
			}}
		>
			<button
				type="button"
				disabled={actions.busyKey !== null}
				data-testid="pending-invite-accept"
				css={getPillButtonCss({ size: 'sm' })}
				onClick={() => actions.accept(invite)}
			>
				{busy ? 'Working…' : 'Accept'}
			</button>
			<button
				type="button"
				disabled={actions.busyKey !== null}
				data-testid="pending-invite-decline"
				css={getGhostButtonCss({ size: 'sm' })}
				onClick={() => actions.decline(invite)}
			>
				Decline
			</button>
		</span>
	)
}

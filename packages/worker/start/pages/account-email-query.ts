import { type PageOrgScope } from '../page-query-scope.ts'
import { type QueryClient } from '@tanstack/react-query'
import { type AccountEmailLoaderData } from '#universal/loader-data.ts'
import {
	emailKeys,
	type EmailListData,
	type EmailDetail,
} from './email-resources.ts'

export type EmailAction = {
	href: string
	orgSlug: string | null
	messageId: string
} & (
	| { action: 'classify'; classification: 'accepted' | 'quarantined' }
	| { action: 'delete' }
)

/** Update known rows only. A newly matching filtered page needs its ordered,
 * paginated server result; guessing an insertion can duplicate or skip rows. */
export function optimisticEmail(
	payload: AccountEmailLoaderData,
	action: EmailAction,
): AccountEmailLoaderData {
	if (action.action === 'delete') return payload
	const patch = {
		classification: action.classification,
		classification_reason:
			action.classification === 'quarantined' ? 'Reclassified by user.' : null,
	}
	const removesRow =
		payload.classification !== null &&
		payload.classification !== action.classification
	const hadRow = payload.messages.some(
		(message) => message.id === action.messageId,
	)
	return {
		...payload,
		messages: payload.messages.flatMap((message) =>
			message.id !== action.messageId
				? [message]
				: removesRow
					? []
					: [{ ...message, ...patch }],
		),
		total:
			removesRow && hadRow ? Math.max(0, payload.total - 1) : payload.total,
		// Selection is independent of list filters on the server too.
		selectedMessage:
			payload.selectedMessage?.id === action.messageId
				? { ...payload.selectedMessage, ...patch }
				: payload.selectedMessage,
	}
}

/** Responses prove the affected entity, not the freshness of unrelated rows.
 * Never replace another concurrent write with the response's list snapshot. */
export async function publishEmailResponse(
	client: QueryClient,
	actorKey: string | null,
	accepted: AccountEmailLoaderData,
	action: EmailAction,
) {
	const org = action.orgSlug
	await client.cancelQueries({ queryKey: emailKeys.all(actorKey, org) })
	client.setQueriesData<EmailListData>(
		{ queryKey: emailKeys.lists(actorKey, org) },
		(data) => {
			if (!data) return data
			const patched = optimisticEmail(
				{ ...data, selectedMessage: null },
				action,
			)
			const { selectedMessage: _selection, ...list } = patched
			if (action.action !== 'delete') return list
			return {
				...list,
				messages: list.messages.filter(
					(message) => message.id !== action.messageId,
				),
				total: list.messages.some((message) => message.id === action.messageId)
					? Math.max(0, list.total - 1)
					: list.total,
			}
		},
	)
	const key = emailKeys.detail(actorKey, org, action.messageId)
	if (action.action === 'delete') client.setQueryData(key, null)
	else if (accepted.selectedMessage?.id === action.messageId)
		client.setQueryData(key, accepted.selectedMessage)
	else
		client.setQueryData<EmailDetail>(key, (detail) =>
			detail
				? {
						...detail,
						classification: action.classification,
						classification_reason:
							action.classification === 'quarantined'
								? 'Reclassified by user.'
								: null,
					}
				: detail,
		)
}

export function emailMutationOptions(
	client: QueryClient,
	actorKey: string | null,
	send: (action: EmailAction) => Promise<AccountEmailLoaderData>,
	onFailure: (error: Error) => void,
	scope: PageOrgScope = { orgSlug: null },
) {
	const org = scope.orgSlug
	return {
		mutationKey: emailKeys.mutations(actorKey, org),
		mutationFn: send,
		onSuccess: (accepted: AccountEmailLoaderData, action: EmailAction) =>
			publishEmailResponse(client, actorKey, accepted, action),
		onError: (error: Error) => onFailure(error),
		// Also reconcile a lost response: the server may have committed. Query
		// reads never wait for writes, and the mutation-state overlay remains
		// visible until this confirming read completes, even after unmount.
		onSettled: (_data: unknown, _error: unknown, action: EmailAction) =>
			client.invalidateQueries({
				queryKey: emailKeys.all(actorKey, action.orgSlug),
			}),
	}
}

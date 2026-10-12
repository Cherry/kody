import { scopedPageResource, pageQueryOrg } from '../page-query-scope.ts'
import { type QueryClient } from '@tanstack/react-query'
import { createListDetailRoute } from '#client/list-detail-route.ts'
import { type AccountEmailLoaderData } from '#universal/loader-data.ts'
import { restorePageResource } from '../page-mutation-cache.ts'

export type EmailAction = {
	href: string
	messageId: string
} & (
	| { action: 'classify'; classification: 'accepted' | 'quarantined' }
	| { action: 'delete' }
)
export type EmailQueryData = { payload: AccountEmailLoaderData }
const emailRoute = createListDetailRoute('/account/email')

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

function sameEmailList(a: AccountEmailLoaderData, b: AccountEmailLoaderData) {
	return (
		a.page === b.page &&
		a.pageSize === b.pageSize &&
		a.query === b.query &&
		a.classification === b.classification
	)
}

/** POST includes a complete list for one filter/page, and only its selected
 * detail. Publish what it proves, then refresh other variants after settlement. */
export async function publishEmailResponse(
	client: QueryClient,
	actorKey: string | null,
	accepted: AccountEmailLoaderData,
	action: EmailAction,
) {
	const filters = scopedPageResource(actorKey, 'loadEmailPage', action.href)
	await client.cancelQueries({
		...filters,
		predicate: (query) =>
			filters.predicate(query) && query.state.data !== undefined,
	})
	const incomplete = new Set<string>()
	for (const query of client.getQueryCache().findAll(filters)) {
		const data = query.state.data as EmailQueryData | undefined
		if (!data) continue
		const href = query.queryKey[3]
		const selectedId =
			typeof href === 'string'
				? emailRoute.getSelection(href).selectedId
				: undefined
		const sameList = sameEmailList(data.payload, accepted)
		const completeDetail =
			selectedId === null ||
			selectedId === accepted.selectedMessage?.id ||
			(action.action === 'delete' && selectedId === action.messageId)
		if (!sameList || !completeDetail) incomplete.add(query.queryHash)
		const updated = optimisticEmail(data.payload, action)
		client.setQueryData(query.queryKey, {
			...data,
			payload: sameList
				? {
						...accepted,
						selectedMessage:
							selectedId === null
								? null
								: selectedId === accepted.selectedMessage?.id
									? accepted.selectedMessage
									: action.action === 'delete' &&
										  selectedId === action.messageId
										? null
										: updated.selectedMessage,
					}
				: {
						...updated,
						selectedMessage:
							selectedId === accepted.selectedMessage?.id
								? accepted.selectedMessage
								: action.action === 'delete' && selectedId === action.messageId
									? null
									: updated.selectedMessage,
						// Never keep a deleted row visible while another filter reloads.
						messages:
							action.action === 'delete'
								? updated.messages.filter(
										(message) => message.id !== action.messageId,
									)
								: updated.messages,
						total:
							action.action === 'delete' &&
							updated.messages.some(
								(message) => message.id === action.messageId,
							)
								? Math.max(0, updated.total - 1)
								: updated.total,
					},
		})
	}
	// Do not await a confirming read inside the mutation lifecycle. Email reads
	// wait for this mutation to settle before fetching authoritative data.
	void client.invalidateQueries({
		...filters,
		predicate: (query) => incomplete.has(query.queryHash),
	})
}

export function emailMutationOptions(
	client: QueryClient,
	actorKey: string | null,
	send: (action: EmailAction) => Promise<AccountEmailLoaderData>,
	onFailure: (error: Error) => void,
	href = '/account/email',
) {
	return {
		mutationKey: ['email', actorKey, pageQueryOrg(href)] as const,
		mutationFn: send,
		onMutate: async (action: EmailAction) => {
			const filters = scopedPageResource(actorKey, 'loadEmailPage', action.href)
			await client.cancelQueries(filters)
			const snapshot = client.getQueriesData<EmailQueryData>(filters)
			client.setQueriesData<EmailQueryData>(
				filters,
				(data) =>
					data && { ...data, payload: optimisticEmail(data.payload, action) },
			)
			return { snapshot }
		},
		onSuccess: (accepted: AccountEmailLoaderData, action: EmailAction) =>
			publishEmailResponse(client, actorKey, accepted, action),
		onError: (
			error: Error,
			action: EmailAction,
			context:
				| {
						snapshot: Array<
							readonly [readonly unknown[], EmailQueryData | undefined]
						>
				  }
				| undefined,
		) => {
			restorePageResource(client, context?.snapshot)
			void client.invalidateQueries({
				...scopedPageResource(actorKey, 'loadEmailPage', action.href),
			})
			onFailure(error)
		},
	}
}

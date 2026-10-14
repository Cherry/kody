import { expect, it, vi } from 'vitest'
import {
	MutationObserver,
	QueryClient,
	QueryObserver,
} from '@tanstack/react-query'
import {
	type AccountEmailLoaderData,
	type AccountEmailMessageDetail,
} from '#universal/loader-data.ts'
import {
	emailMutationOptions,
	optimisticEmail,
	publishEmailResponse,
	type EmailAction,
} from './account-email-query.ts'
import {
	emailKeys,
	emailResourceInput,
	type EmailListData,
} from './email-resources.ts'

const message: AccountEmailMessageDetail = {
	id: 'one',
	direction: 'inbound',
	inbox_id: null,
	thread_id: null,
	from_address: 'sender@example.com',
	envelope_from: null,
	to_addresses: [],
	subject: 'Hello',
	message_id_header: null,
	processing_status: 'stored',
	classification: 'quarantined',
	classification_reason: 'Original reason',
	provider_message_id: null,
	delivery_status: null,
	delivery_status_at: null,
	error: null,
	received_at: null,
	sent_at: null,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z',
	cc_addresses: [],
	bcc_addresses: [],
	reply_to_addresses: [],
	in_reply_to_header: null,
	references: [],
	headers: null,
	auth_results: null,
	text_body: 'Hello',
	html_body: null,
	raw_size: null,
	attachments: [],
	delivery_events: [],
}
const payload = (
	overrides: Partial<AccountEmailLoaderData> = {},
): AccountEmailLoaderData => ({
	ok: true,
	emailVerified: true,
	email: 'owner@example.com',
	username: 'owner',
	inboxAddress: null,
	verificationMessage: null,
	inboxes: [],
	messages: [message],
	selectedMessage: message,
	usage: null,
	page: 1,
	pageSize: 25,
	total: 1,
	query: '',
	classification: null,
	...overrides,
})
const action: EmailAction = {
	action: 'classify',
	href: '/account/email/one',
	messageId: 'one',
	classification: 'accepted',
}

function seed(client: QueryClient, href: string, actor = 'a') {
	const { list, messageId } = emailResourceInput(href)
	const { selectedMessage, ...data } = payload({
		query: list.query,
		classification: list.classification,
		page: list.page,
		pageSize: list.pageSize,
	})
	client.setQueryData(emailKeys.list(actor, list), data)
	if (messageId)
		client.setQueryData(emailKeys.detail(actor, list.org, messageId), {
			...selectedMessage!,
			id: messageId,
		})
	return {
		listKey: emailKeys.list(actor, list),
		detailKey: emailKeys.detail(actor, list.org, messageId),
	}
}
it('selection reuses the list key, normalizes filters, and isolates actor and organization', () => {
	const a = emailResourceInput(
		'/@acme/-/email/one?q=%20hello%20&page=01&pageSize=999',
	)
	const b = emailResourceInput('/@acme/-/email/two?page=1&pageSize=100&q=hello')
	expect(emailKeys.list('a', a.list)).toEqual(emailKeys.list('a', b.list))
	expect(a.messageId).toBe('one')
	expect(b.messageId).toBe('two')
	expect(emailKeys.list('b', a.list)).not.toEqual(emailKeys.list('a', a.list))
	expect(emailKeys.list('a', { ...a.list, org: 'other' })).not.toEqual(
		emailKeys.list('a', a.list),
	)
	expect(emailKeys.destinations('a')).not.toEqual(emailKeys.destinations('b'))
})
it('optimism removes only known filtered rows without inventing page membership', () => {
	const result = optimisticEmail(
		payload({ classification: 'quarantined' }),
		action,
	)
	expect(result.messages).toEqual([])
	expect(result.total).toBe(0)
	expect(result.selectedMessage?.classification).toBe('accepted')
	expect(optimisticEmail(result, action).total).toBe(0)
	const unknown = payload({
		messages: [],
		selectedMessage: null,
		total: 30,
		page: 2,
	})
	expect(optimisticEmail(unknown, action)).toEqual(unknown)
})
it('publishes only the affected entity, preserving concurrent rows, other selections and scopes', async () => {
	const client = new QueryClient()
	const first = seed(client, '/@acme/-/email/one')
	const second = seed(client, '/@acme/-/email/two')
	const other = seed(client, '/@other/-/email/one')
	const actor = seed(client, '/@acme/-/email/one', 'b')
	const current = client.getQueryData<EmailListData>(first.listKey)!
	client.setQueryData(first.listKey, {
		...current,
		messages: [
			...current.messages,
			{ ...message, id: 'two', classification: 'accepted' },
		],
	})
	await publishEmailResponse(client, 'a', optimisticEmail(payload(), action), {
		...action,
		href: '/@acme/-/email/one',
	})
	const rows = client.getQueryData<EmailListData>(first.listKey)!.messages
	expect(rows.map((row) => row.classification)).toEqual([
		'accepted',
		'accepted',
	])
	expect(
		client.getQueryData<AccountEmailMessageDetail>(second.detailKey)?.id,
	).toBe('two')
	expect(
		client.getQueryData<AccountEmailMessageDetail>(other.detailKey)
			?.classification,
	).toBe('quarantined')
	expect(
		client.getQueryData<AccountEmailMessageDetail>(actor.detailKey)
			?.classification,
	).toBe('quarantined')
	client.clear()
})
it('keeps pending deletion visible, then removes confirmed rows and detail', async () => {
	const client = new QueryClient()
	const keys = seed(client, '/account/email/one')
	const deletion: EmailAction = {
		action: 'delete',
		href: '/account/email/one',
		messageId: 'one',
	}
	const before = payload()
	expect(optimisticEmail(before, deletion)).toBe(before)
	await publishEmailResponse(
		client,
		'a',
		payload({ selectedMessage: null, messages: [], total: 0 }),
		deletion,
	)
	expect(client.getQueryData(keys.detailKey)).toBeNull()
	expect(client.getQueryData<EmailListData>(keys.listKey)?.messages).toEqual([])
	expect(client.getQueryData<EmailListData>(keys.listKey)?.total).toBe(0)
	client.clear()
})
it.each(['accepted', 'lost-response'] as const)(
	'reconciles %s after unmount without blocking reads or rolling back another write',
	async (outcome) => {
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const keys = seed(client, '/account/email/one')
		let release!: (value: AccountEmailLoaderData) => void
		let reject!: (error: Error) => void
		const send = vi.fn(
			() =>
				new Promise<AccountEmailLoaderData>((resolve, fail) => {
					release = resolve
					reject = fail
				}),
		)
		const notify = vi.fn()
		const mutation = new MutationObserver(
			client,
			emailMutationOptions(client, 'a', send, notify),
		)
		const unsubscribe = mutation.subscribe(() => {})
		const write = mutation.mutate(action).catch(() => undefined)
		await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
		unsubscribe()
		// A background read is allowed during a write. Applying pending intent to
		// its result preserves optimistic UI without altering authoritative data.
		const read = vi.fn(async () => payload())
		const fresh = await client.fetchQuery({
			queryKey: ['independent-read'],
			queryFn: read,
		})
		expect(read).toHaveBeenCalledOnce()
		expect(optimisticEmail(fresh, action).selectedMessage?.classification).toBe(
			'accepted',
		)
		expect(
			client.getQueryData<AccountEmailMessageDetail>(keys.detailKey)
				?.classification,
		).toBe('quarantined')
		const confirmed = { ...message, classification: 'accepted' as const }
		const confirmingRead = vi.fn(async () => confirmed)
		const observer = new QueryObserver(client, {
			queryKey: keys.detailKey,
			queryFn: confirmingRead,
			staleTime: Infinity,
		})
		const stop = observer.subscribe(() => {})
		if (outcome === 'accepted') release(optimisticEmail(payload(), action))
		else reject(new Error('Lost response after commit'))
		await write
		expect(confirmingRead).toHaveBeenCalledOnce()
		expect(
			client.getQueryData<AccountEmailMessageDetail>(keys.detailKey)
				?.classification,
		).toBe('accepted')
		expect(notify).toHaveBeenCalledTimes(outcome === 'lost-response' ? 1 : 0)
		expect(client.isMutating()).toBe(0)
		stop()
		client.clear()
	},
)

it('a failed concurrent classification never rolls back another accepted message', async () => {
	const client = new QueryClient()
	const keys = seed(client, '/account/email/one')
	const list = client.getQueryData<EmailListData>(keys.listKey)!
	client.setQueryData(keys.listKey, {
		...list,
		messages: [message, { ...message, id: 'two' }],
	})
	let failFirst!: (error: Error) => void
	let acceptSecond!: (data: AccountEmailLoaderData) => void
	const first = new MutationObserver(
		client,
		emailMutationOptions(
			client,
			'a',
			() =>
				new Promise((_resolve, reject) => {
					failFirst = reject
				}),
			() => {},
		),
	)
	const second = new MutationObserver(
		client,
		emailMutationOptions(
			client,
			'a',
			() =>
				new Promise((resolve) => {
					acceptSecond = resolve
				}),
			() => {},
		),
	)
	const writeOne = first.mutate(action).catch(() => undefined)
	const actionTwo = { ...action, href: '/account/email/two', messageId: 'two' }
	const writeTwo = second.mutate(actionTwo)
	await vi.waitFor(() => expect(client.isMutating()).toBe(2))
	acceptSecond(
		payload({
			selectedMessage: { ...message, id: 'two', classification: 'accepted' },
		}),
	)
	await writeTwo
	failFirst(new Error('First write rejected'))
	await writeOne
	expect(
		client
			.getQueryData<EmailListData>(keys.listKey)
			?.messages.map((row) => row.classification),
	).toEqual(['quarantined', 'accepted'])
	expect(client.getQueryState(keys.listKey)?.isInvalidated).toBe(true)
	client.clear()
})

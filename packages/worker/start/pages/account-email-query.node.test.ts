import { describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import {
	type AccountEmailLoaderData,
	type AccountEmailMessageDetail,
} from '#universal/loader-data.ts'
import { createPageQuery, ensurePageQuery } from '../page-query.ts'
import { pageResourceKey } from '../page-mutation-cache.ts'
import {
	emailMutationOptions,
	optimisticEmail,
	publishEmailResponse,
	type EmailAction,
	type EmailQueryData,
} from './account-email-query.ts'

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
const key = (href: string, actor = 'a') => [
	...pageResourceKey(actor, 'loadEmailPage'),
	href,
]
const readPayload = (client: QueryClient, href: string, actor = 'a') =>
	client.getQueryData<EmailQueryData>(key(href, actor))!.payload

it('removes a known row from quarantine without removing independent selection or inventing pagination membership', () => {
	const result = optimisticEmail(
		payload({ classification: 'quarantined' }),
		action,
	)
	expect(result.messages).toEqual([])
	expect(result.total).toBe(0)
	expect(result.selectedMessage?.classification).toBe('accepted')
	expect(optimisticEmail(result, action).total).toBe(0)
	const unknownPage = payload({
		page: 2,
		messages: [],
		total: 30,
		selectedMessage: null,
		classification: 'quarantined',
	})
	expect(
		optimisticEmail(unknownPage, { ...action, classification: 'quarantined' }),
	).toEqual(unknownPage)
})

it('publishes only matching page/filter responses, preserves other selections, and invalidates incomplete variants', async () => {
	const client = new QueryClient()
	const variants = [
		['/account/email', payload({ selectedMessage: null })],
		['/account/email/one', payload()],
		[
			'/account/email/two',
			payload({ selectedMessage: { ...message, id: 'two' } }),
		],
		[
			'/account/email?page=2',
			payload({ page: 2, messages: [], selectedMessage: null }),
		],
		[
			'/account/email?q=other',
			payload({ query: 'other', messages: [], selectedMessage: null }),
		],
		[
			'/account/email?classification=quarantined',
			payload({ classification: 'quarantined', selectedMessage: null }),
		],
	] as const
	for (const [href, value] of variants)
		client.setQueryData(key(href), {
			payload: value,
			destinations: 'untouched',
		})
	client.setQueryData(key('/account/email', 'b'), { payload: payload() })
	const accepted = optimisticEmail(payload(), action)
	await publishEmailResponse(client, 'a', accepted, action)
	expect(readPayload(client, '/account/email').selectedMessage).toBeNull()
	expect(
		readPayload(client, '/account/email/one').selectedMessage?.classification,
	).toBe('accepted')
	expect(readPayload(client, '/account/email/two').selectedMessage?.id).toBe(
		'two',
	)
	expect(readPayload(client, '/account/email?page=2').page).toBe(2)
	expect(readPayload(client, '/account/email?q=other').messages).toEqual([])
	expect(
		readPayload(client, '/account/email?classification=quarantined').messages,
	).toEqual([])
	expect(
		readPayload(client, '/account/email', 'b').messages[0]?.classification,
	).toBe('quarantined')
	for (const [href] of variants)
		expect(client.getQueryState(key(href))?.isInvalidated).toBe(
			!['/account/email', '/account/email/one'].includes(href),
		)
	expect(client.getQueryData(key('/account/email'))).toHaveProperty(
		'destinations',
		'untouched',
	)
	client.clear()
})

describe.each(['accepted', 'rejected'] as const)(
	'held classification %s',
	(outcome) => {
		it('survives observer unmount, keeps cached navigation optimistic, blocks uncached reads and settles correctly', async () => {
			const client = new QueryClient({
				defaultOptions: { queries: { retry: false } },
			})
			client.setQueryData(key('/account/email/one'), { payload: payload() })
			client.setQueryData(key('/account/email?classification=quarantined'), {
				payload: payload({
					classification: 'quarantined',
					selectedMessage: null,
				}),
			})
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
			const observer = new MutationObserver(
				client,
				emailMutationOptions(client, 'a', send, notify),
			)
			const unsubscribe = observer.subscribe(() => {})
			const write = observer.mutate(action).catch(() => undefined)
			await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
			unsubscribe()
			const read = vi.fn(async () => ({ payload: payload() }))
			const options = createPageQuery('loadEmailPage', read)(
				'a',
				'/account/email/one',
			)
			const cached = await ensurePageQuery(client, options, false)
			expect(cached.payload.selectedMessage?.classification).toBe('accepted')
			expect(
				readPayload(client, '/account/email?classification=quarantined')
					.messages,
			).toEqual([])
			const uncached = client.fetchQuery(
				createPageQuery('loadEmailPage', read)('a', '/account/email?page=2'),
			)
			await Promise.resolve()
			expect(read).not.toHaveBeenCalled()
			if (outcome === 'accepted') release(optimisticEmail(payload(), action))
			else reject(new Error('Controlled write rejection'))
			await write
			await uncached
			expect(read).toHaveBeenCalledOnce()
			expect(
				readPayload(client, '/account/email/one').selectedMessage
					?.classification,
			).toBe(outcome === 'accepted' ? 'accepted' : 'quarantined')
			expect(notify).toHaveBeenCalledTimes(outcome === 'rejected' ? 1 : 0)
			expect(client.isMutating()).toBe(0)
			client.clear()
		})
	},
)

it('keeps deletion pending until acceptance, then removes cached rows and details across filters', async () => {
	const client = new QueryClient()
	const deletion: EmailAction = {
		action: 'delete',
		href: '/account/email/one',
		messageId: 'one',
	}
	const before = payload()
	expect(optimisticEmail(before, deletion)).toBe(before)
	client.setQueryData(key('/account/email/one'), { payload: before })
	client.setQueryData(key('/account/email?classification=quarantined'), {
		payload: payload({ classification: 'quarantined' }),
	})
	await publishEmailResponse(
		client,
		'a',
		payload({ messages: [], selectedMessage: null, total: 0 }),
		deletion,
	)
	expect(readPayload(client, '/account/email/one').selectedMessage).toBeNull()
	expect(readPayload(client, '/account/email/one').messages).toEqual([])
	expect(
		readPayload(client, '/account/email?classification=quarantined').messages,
	).toEqual([])
	expect(
		readPayload(client, '/account/email?classification=quarantined').total,
	).toBe(0)
	client.clear()
})

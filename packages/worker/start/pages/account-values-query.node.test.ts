import { expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { createPageQuery, ensurePageQuery } from '../page-query.ts'
import { type AccountValueDetail } from '#universal/loader-data.ts'
import {
	valuesMutationOptions,
	type ValuesQueryData,
} from './account-values-query.ts'

const detail: AccountValueDetail = {
	id: 'one',
	name: 'first',
	description: '',
	value: 'value',
	createdAt: '2026-01-01',
	updatedAt: '2026-01-01',
	ttlMs: null,
	scope: 'user',
}
const other = { ...detail, id: 'two', name: 'second' }
const row = (value: AccountValueDetail) => ({
	...value,
	valuePreview: value.value,
})
const data = (selectedValue: AccountValueDetail | null): ValuesQueryData => ({
	payload: {
		ok: true,
		values: [row(detail), row(other)],
		selectedValue,
		selectedValueId: selectedValue?.id ?? null,
	},
})
const key = (selection: string | { orgSlug: string }, actor = 'a') => [
	'page',
	actor,
	'loadValuesPage',
	typeof selection === 'string' ? { selectedValueId: selection } : selection,
]

it('publishes accepted deletion after unmount, preserving selection and actor isolation', async () => {
	const client = new QueryClient()
	client.setQueryData(key('list'), data(null))
	client.setQueryData(key('one'), data(detail))
	client.setQueryData(key('two'), data(other))
	client.setQueryData(key('one', 'b'), data(detail))
	client.setQueryData(['page', 'a', 'loadUsagePage', ''], {})
	let accept!: (value: ValuesQueryData['payload']) => void
	const observer = new MutationObserver(
		client,
		valuesMutationOptions(
			client,
			'a',
			() =>
				new Promise((resolve) => {
					accept = resolve
				}),
		),
	)
	const unsubscribe = observer.subscribe(() => {})
	const submitted = observer.mutate({ name: 'first', orgSlug: null })
	await vi.waitFor(() => expect(accept).toBeTypeOf('function'))
	unsubscribe()
	let finishRead!: (value: ValuesQueryData) => void
	const lateRead = client
		.fetchQuery({
			queryKey: key('one'),
			queryFn: () =>
				new Promise<ValuesQueryData>((resolve) => {
					finishRead = resolve
				}),
		})
		.catch(() => undefined)
	accept({ ...data(null).payload, values: [row(other)] })
	await submitted
	finishRead(data(detail))
	await lateRead
	expect(
		client.getQueryData<ValuesQueryData>(key('list'))?.payload.values,
	).toEqual([row(other)])
	expect(
		client.getQueryData<ValuesQueryData>(key('one'))?.payload.selectedValue,
	).toBeNull()
	expect(
		client.getQueryData<ValuesQueryData>(key('two'))?.payload.selectedValue,
	).toEqual(other)
	expect(
		client.getQueryData<ValuesQueryData>(key('one', 'b'))?.payload.values,
	).toHaveLength(2)
	expect(client.getQueryState(key('list'))?.isInvalidated).toBe(false)
	expect(client.getQueryState(key('two'))?.isInvalidated).toBe(true)
	expect(
		client.getQueryState(['page', 'a', 'loadUsagePage', ''])?.isInvalidated,
	).toBe(true)
	client.clear()
})

it('keeps confirmed data when deletion fails', async () => {
	const client = new QueryClient()
	client.setQueryData(key('one'), data(detail))
	const observer = new MutationObserver(
		client,
		valuesMutationOptions(client, 'a', async () => {
			throw new Error('Denied')
		}),
	)
	await expect(
		observer.mutate({ name: 'first', orgSlug: null }),
	).rejects.toThrow('Denied')
	expect(client.getQueryData(key('one'))).toEqual(data(detail))
	client.clear()
})

it('waits for a pending deletion before reading an uncached navigation', async () => {
	const client = new QueryClient()
	let accept!: (value: ValuesQueryData['payload']) => void
	const observer = new MutationObserver(
		client,
		valuesMutationOptions(
			client,
			'a',
			() =>
				new Promise((resolve) => {
					accept = resolve
				}),
		),
	)
	const submitted = observer.mutate({ name: 'first', orgSlug: null })
	await vi.waitFor(() => expect(accept).toBeTypeOf('function'))
	const accepted = { ...data(null).payload, values: [row(other)] }
	const read = vi.fn(async () => ({ payload: accepted }))
	const options = createPageQuery('loadValuesPage', read)('a', {
		orgSlug: null,
	})
	const loading = ensurePageQuery(client, options, false)
	await Promise.resolve()
	expect(read).not.toHaveBeenCalled()
	accept(accepted)
	await submitted
	await loading
	expect(read).toHaveBeenCalledOnce()
	expect(
		client.getQueryData<ValuesQueryData>(options.queryKey)?.payload.values,
	).toEqual([row(other)])
	client.clear()
})

it('keeps the submitted org when observer options change during a pending write', async () => {
	const client = new QueryClient()
	const alpha = { orgSlug: 'alpha' }
	const beta = { orgSlug: 'beta' }
	client.setQueryData(key(alpha), data(detail))
	client.setQueryData(key(beta), data(detail))
	let accept!: (value: ValuesQueryData['payload']) => void
	const send = () =>
		new Promise<ValuesQueryData['payload']>((resolve) => {
			accept = resolve
		})
	const observer = new MutationObserver(
		client,
		valuesMutationOptions(client, 'a', send, { orgSlug: 'alpha' }),
	)
	const unsubscribe = observer.subscribe(() => {})
	const submitted = observer.mutate({ name: 'first', orgSlug: 'alpha' })
	await vi.waitFor(() => expect(accept).toBeTypeOf('function'))
	observer.setOptions(
		valuesMutationOptions(client, 'a', send, { orgSlug: 'beta' }),
	)
	accept({ ...data(null).payload, values: [row(other)] })
	await submitted
	expect(
		client.getQueryData<ValuesQueryData>(key(alpha))?.payload.values,
	).toHaveLength(1)
	expect(
		client.getQueryData<ValuesQueryData>(key(beta))?.payload.values,
	).toHaveLength(2)
	unsubscribe()
	client.clear()
})

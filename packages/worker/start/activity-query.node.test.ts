import { expect, it, vi } from 'vitest'
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { activityQuery, loadActivityQuery } from './activity-query.ts'
import { loadActivityPage } from '#start/server/account-collections'

vi.mock('#start/server/account-collections', () => ({
	loadActivityPage: vi.fn(),
}))

it('reuses loader data and preserves org and filters across cursor pages', async () => {
	const read = vi.mocked(loadActivityPage)
	read.mockImplementation(
		async ({ data }) =>
			({
				payload: {
					runs: [
						{
							id:
								new URL(data, 'https://kody.local').searchParams.get(
									'cursor',
								) ?? 'first',
						},
					],
					nextCursor: data.includes('cursor=second') ? null : 'second',
				},
				head: { title: 'Activity' },
			}) as Awaited<ReturnType<typeof loadActivityPage>>,
	)
	const client = new QueryClient()
	const href = '/@team-one/-/activity?status=error&surface=execute'
	await loadActivityQuery(client, 'actor', href)
	const observer = new InfiniteQueryObserver(
		client,
		activityQuery('actor', href),
	)
	const unsubscribe = observer.subscribe(() => {})
	expect(read).toHaveBeenCalledTimes(1)
	await observer.fetchNextPage()
	expect(read).toHaveBeenCalledTimes(2)
	expect(read.mock.calls[1]?.[0].data).toBe(`${href}&cursor=second`)
	expect(
		observer
			.getCurrentResult()
			.data?.pages.map((page) => page.payload.runs[0]?.id),
	).toEqual(['first', 'second'])
	expect(observer.getCurrentResult().hasNextPage).toBe(false)
	await loadActivityQuery(
		client,
		'actor',
		'/@team-two/-/activity?status=error&surface=execute',
	)
	expect(read).toHaveBeenCalledTimes(3)
	expect(observer.getCurrentResult().data?.pages).toHaveLength(2)
	unsubscribe()
	client.clear()
})

import { expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { scopedPageResource } from './page-query-scope.ts'

it('updates only the submitting org and actor across list and detail variants', () => {
	const client = new QueryClient()
	const key = (href: string, actor = 'one') => [
		'page',
		actor,
		'loadJobsPage',
		href,
	]
	for (const href of [
		'/@alpha/-/jobs',
		'/@alpha/-/jobs/one',
		'/@beta/-/jobs',
		'/account/jobs',
	])
		client.setQueryData(key(href), 'before')
	client.setQueryData(key('/@alpha/-/jobs', 'two'), 'before')
	client.setQueriesData(
		scopedPageResource('one', 'loadJobsPage', '/@alpha/-/jobs/one'),
		'after',
	)
	expect(client.getQueryData(key('/@alpha/-/jobs'))).toBe('after')
	expect(client.getQueryData(key('/@alpha/-/jobs/one'))).toBe('after')
	expect(client.getQueryData(key('/@beta/-/jobs'))).toBe('before')
	expect(client.getQueryData(key('/account/jobs'))).toBe('before')
	expect(client.getQueryData(key('/@alpha/-/jobs', 'two'))).toBe('before')
	client.clear()
})

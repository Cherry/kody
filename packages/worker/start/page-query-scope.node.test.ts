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

it('keeps organization usage and billing cache writes scoped to their URL org', () => {
	const client = new QueryClient()
	for (const resource of ['loadUsagePage', 'loadBillingPage']) {
		const section = resource === 'loadUsagePage' ? 'usage' : 'billing'
		const key = (org: string, actor = 'one') => [
			'page',
			actor,
			resource,
			`/@${org}/-/${section}`,
		]
		client.setQueryData(key('alpha'), 'before')
		client.setQueryData(key('beta'), 'before')
		client.setQueryData(key('alpha', 'two'), 'before')
		client.setQueriesData(
			scopedPageResource('one', resource, `/@alpha/-/${section}`),
			'after',
		)
		expect(client.getQueryData(key('alpha'))).toBe('after')
		expect(client.getQueryData(key('beta'))).toBe('before')
		expect(client.getQueryData(key('alpha', 'two'))).toBe('before')
	}
	client.clear()
})

it('updates typed collection inputs without crossing org or actor boundaries', () => {
	const client = new QueryClient()
	const key = (orgSlug: string, actor = 'one', jobId?: string) => [
		'page',
		actor,
		'loadJobsPage',
		{ orgSlug, jobId },
	]
	for (const queryKey of [
		key('alpha'),
		key('alpha', 'one', 'job'),
		key('beta'),
		key('alpha', 'two'),
	])
		client.setQueryData(queryKey, 'before')
	client.setQueriesData(
		scopedPageResource('one', 'loadJobsPage', '/@alpha/-/jobs/job'),
		'after',
	)
	expect(client.getQueryData(key('alpha'))).toBe('after')
	expect(client.getQueryData(key('alpha', 'one', 'job'))).toBe('after')
	expect(client.getQueryData(key('beta'))).toBe('before')
	expect(client.getQueryData(key('alpha', 'two'))).toBe('before')
	client.clear()
})

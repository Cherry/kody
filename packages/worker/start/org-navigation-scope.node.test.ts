import { expect, test } from 'vitest'
import { orgNavigationScope } from './org-navigation-scope.ts'

test('native matches supply organization and section without interpreting destination URLs', () => {
	expect(
		orgNavigationScope([
			{
				routeId: '/@{$orgSlug}_/-/jobs_/$jobId',
				params: { orgSlug: 'acme', jobId: 'one' },
			},
		]),
	).toEqual({ orgSlug: 'acme', section: 'jobs' })
	expect(
		orgNavigationScope([
			{ routeId: '/@{$orgSlug}_/-/members', params: { orgSlug: 'acme' } },
		]),
	).toEqual({ orgSlug: 'acme', section: undefined })
	expect(
		orgNavigationScope([
			{
				routeId: '/@{$username}/$kodyId',
				params: { username: 'acme', kodyId: 'jobs' },
			},
		]),
	).toBeUndefined()
	expect(
		orgNavigationScope([{ routeId: '__root__', params: {} }]),
	).toBeUndefined()
})

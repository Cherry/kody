import { describe, expect, it } from 'vitest'
import { needsJobDetailRefresh } from './account-jobs-query.ts'

describe('job mutation response coverage', () => {
	it('keeps other canonical details stale while reusing the accepted detail and list', () => {
		expect(needsJobDetailRefresh('/account/jobs/other', 'accepted')).toBe(true)
		expect(needsJobDetailRefresh('/account/jobs/accepted', 'accepted')).toBe(
			false,
		)
		expect(needsJobDetailRefresh('/account/jobs?q=filter', 'accepted')).toBe(
			false,
		)
	})
	it('matches query selections and encoded path IDs using server selection priority', () => {
		expect(
			needsJobDetailRefresh('/account/jobs?selected=other', 'accepted'),
		).toBe(true)
		expect(
			needsJobDetailRefresh('/account/jobs?selected=accepted', 'accepted'),
		).toBe(false)
		expect(
			needsJobDetailRefresh(
				'/account/jobs/package%2Ejob?selected=other',
				'package.job',
			),
		).toBe(false)
		expect(
			needsJobDetailRefresh(
				'/account/jobs/other?selected=accepted',
				'accepted',
			),
		).toBe(true)
	})
})

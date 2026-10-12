import { describe, expect, it } from 'vitest'
import { pageSearch } from './page-search.ts'

describe('page resource search inputs', () => {
	it('keeps data selection while ignoring presentation and attribution', () => {
		expect(
			pageSearch('?utm_source=email&view=enabled&q=deploy&selected=job-1', [
				'selected',
			]),
		).toBe('?selected=job-1')
	})
	it('preserves server-side filters, empty values and the first repeated input', () => {
		expect(
			pageSearch('?includeDeleted=yes&q=&q=second&selected=a%2Fb', [
				'selected',
				'q',
				'includeDeleted',
			]),
		).toBe('?selected=a%2Fb&q=&includeDeleted=yes')
	})
	it('uses the same cache input regardless of original parameter order', () => {
		expect(pageSearch('?q=one&selected=two', ['selected', 'q'])).toBe(
			pageSearch('?selected=two&q=one&utm_campaign=test', ['selected', 'q']),
		)
		expect(pageSearch('?utm_source=test', [])).toBe('')
	})
})

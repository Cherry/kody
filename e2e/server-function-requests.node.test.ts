import { expect, test } from 'vitest'
import { requestNamesDestination } from './server-function-requests.ts'

test('counts a page string input but not authorization for the exact same destination', () => {
	const destination = '/@team/-/jobs'
	const string = { t: 1, s: destination }
	const page = { t: { t: 10, p: { k: ['data'], v: [string] } } }
	const guard = {
		t: {
			t: 10,
			p: { k: ['data'], v: [{ t: 10, p: { k: ['pathname'], v: [string] } }] },
		},
	}
	function request(payload: unknown) {
		return {
			method: () => 'GET',
			url: () =>
				`https://kody.test/_serverFn/example?${new URLSearchParams({ payload: JSON.stringify(payload) })}`,
		}
	}
	expect(requestNamesDestination(request(page), destination)).toBe(true)
	expect(requestNamesDestination(request(guard), destination)).toBe(false)
	expect(
		requestNamesDestination(request(page), `${destination}?selected=one`),
	).toBe(false)
})

import { expect, test } from 'vitest'
import { memoriesInput } from './memories-input.ts'

test('memory query keys contain normalized resource filters, not navigation decoration', () => {
	expect(
		memoriesInput(
			'team',
			'?q=+meeting+&includeDeleted=YES&selected=one&youtubeId=ignored',
			'two',
		),
	).toEqual({
		orgSlug: 'team',
		memoryId: 'two',
		selected: 'one',
		query: 'meeting',
		includeDeleted: true,
	})
	expect(memoriesInput('team', '?includeDeleted=false')).toEqual({
		orgSlug: 'team',
		memoryId: undefined,
		selected: undefined,
		query: '',
		includeDeleted: false,
	})
})

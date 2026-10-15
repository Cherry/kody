import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	defaultParseSearch,
} from '@tanstack/react-router'
import { expect, test } from 'vitest'
import {
	collectionSearch,
	memoriesSearch,
	secretsSearch,
} from './filter-search.ts'
import { adminUsersFilters, adminUsersSearch } from './admin-users-input.ts'
import { memoriesInput } from './memories-input.ts'

const validators = [
	collectionSearch,
	memoriesSearch,
	secretsSearch,
	adminUsersSearch,
]

for (const validateSearch of validators) {
	test(`${validateSearch.name} preserves text through native Router navigation and bookmarked primitives`, async () => {
		const root = createRootRoute()
		const page = createRoute({
			getParentRoute: () => root,
			path: '/filters',
			validateSearch,
		})
		const router = createRouter({
			routeTree: root.addChildren([page]),
			history: createMemoryHistory({ initialEntries: ['/filters'] }),
			isServer: false,
		})
		await router.load()
		const queries = [
			'123',
			'true',
			'false',
			'null',
			'"hello"',
			'["123","true"]',
			'{ "value": true }',
			' 123 ',
		]
		for (const q of queries) {
			await router.navigate({
				to: '/filters',
				search: (previous: Record<string, unknown>) => ({ ...previous, q }),
			})
			const parsed = router.state.location.search
			expect(validateSearch(parsed).q).toBe(q)
			expect(
				validateSearch(defaultParseSearch(router.state.location.searchStr)).q,
			).toBe(q)
			expect(memoriesInput('explicit-org', parsed).query).toBe(q.trim())
			expect(adminUsersFilters(parsed).query).toBe(q.trim())
		}
		for (const q of ['123', 'true', 'false', 'null']) {
			await router.navigate({ href: `/filters?q=${q}` })
			expect(validateSearch(router.state.location.search).q).toBe(q)
		}
	})
}

test('memory filters keep boolean state and explicit resource scope while composing search edits', () => {
	const parsed = memoriesSearch(
		defaultParseSearch(
			'?q=%22123%22&includeDeleted=true&orgSlug=other&actorKey=other',
		),
	)
	expect(memoriesInput('explicit-org', parsed, 'explicit-memory')).toEqual({
		orgSlug: 'explicit-org',
		memoryId: 'explicit-memory',
		selected: undefined,
		query: '123',
		includeDeleted: true,
	})
	expect(memoriesSearch({ ...parsed, q: 'true' }).includeDeleted).toBe(true)
	expect(memoriesSearch({ ...parsed, includeDeleted: false }).q).toBe('123')
	expect(memoriesSearch({}).q).toBeUndefined()
})

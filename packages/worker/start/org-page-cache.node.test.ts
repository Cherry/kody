import { expect, test } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { updateOrgPagePayload } from './org-page-cache.ts'

test('a settled write updates only its initiating actor and workspace across list and detail entries', () => {
	const client = new QueryClient()
	const keys = [
		['page', 'alice', 'loadMcpServersPage', '/@one/-/mcp-servers'],
		['page', 'alice', 'loadMcpServersPage', '/@one/-/mcp-servers/server'],
		['page', 'alice', 'loadMcpServersPage', '/@two/-/mcp-servers'],
		['page', 'bob', 'loadMcpServersPage', '/@one/-/mcp-servers'],
		['page', 'alice', 'loadSecretsPage', '/@one/-/secrets'],
		['page', 'alice', 'loadMcpServersPage', { orgSlug: 'one' }],
		[
			'page',
			'alice',
			'loadMcpServersPage',
			{ orgSlug: 'one', serverId: 'server' },
		],
		['page', 'alice', 'loadMcpServersPage', { orgSlug: 'two' }],
		['page', 'bob', 'loadMcpServersPage', { orgSlug: 'one' }],
	]
	for (const key of keys)
		client.setQueryData(key, {
			payload: { revision: 0 },
			head: { title: 'kept' },
		})
	updateOrgPagePayload<{ revision: number }>(
		client,
		'alice',
		'loadMcpServersPage',
		'/@one/-/mcp-servers',
		() => ({ revision: 1 }),
	)
	expect(keys.map((key) => client.getQueryData(key))).toEqual(
		[1, 1, 0, 0, 0, 1, 1, 0, 0].map((revision) => ({
			payload: { revision },
			head: { title: 'kept' },
		})),
	)
	client.clear()
})

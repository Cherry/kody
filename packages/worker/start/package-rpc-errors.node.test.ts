import { expect, test, vi } from 'vitest'
import { createClientRpc } from '@tanstack/start-client-core/client-rpc'
import { toJSONAsync } from 'seroval'
vi.mock('@tanstack/start-storage-context', () => ({
	getStartContext: () => ({ startOptions: {} }),
}))

test('Start preserves structured package recovery data on non-success RPC status', async () => {
	const result = {
		ok: false,
		error: 'Review this capability set first.',
		approvalUrl: '/@team/repo/approve-capabilities',
	}
	const rpc = createClientRpc('package-review-contract')
	const response = await rpc({
		method: 'POST',
		data: { packageId: 'package' },
		fetch: async () =>
			new Response(JSON.stringify(await toJSONAsync({ result })), {
				status: 409,
				headers: {
					'content-type': 'application/json',
					'x-tss-serialized': 'true',
				},
			}),
	})
	expect(response).toEqual({ result })
})

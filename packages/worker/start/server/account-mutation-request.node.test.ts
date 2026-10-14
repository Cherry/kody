import { expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
	request: new Request('https://kody.test/_serverFn/mutation', {
		method: 'POST',
		headers: { cookie: 'session=original' },
	}),
	mutate: vi.fn(async () => ({ value: { ok: true }, status: 200 })),
}))
vi.mock('@tanstack/react-start', () => ({
	createServerFn: () => {
		let schema: { parse: (data: unknown) => unknown }
		const builder = {
			validator(next: typeof schema) {
				schema = next
				return builder
			},
			handler(run: (input: { data: unknown }) => unknown) {
				return (input: { data: unknown }) =>
					run({ data: schema.parse(input.data) })
			},
		}
		return builder
	},
}))
vi.mock('./mutation-context.ts', () => ({
	withWebsiteMutation: async (
		_options: unknown,
		run: (context: unknown) => unknown,
	) => run({ request: state.request, env: {}, user: {} }),
}))
vi.mock('../../src/app/handlers/account-jobs.ts', () => ({
	mutateAccountJobs: state.mutate,
}))
vi.mock('../../src/app/handlers/account-workflows.ts', () => ({
	mutateAccountWorkflows: state.mutate,
}))
vi.mock('../../src/app/handlers/account-secret-providers.ts', () => ({
	mutateAccountSecretProviders: state.mutate,
}))
vi.mock('../../src/app/handlers/account-integrations.ts', () => ({
	mutateAccountIntegrations: state.mutate,
}))
vi.mock('../../src/app/handlers/account-connections.ts', () => ({
	mutateAccountConnections: state.mutate,
}))
vi.mock('../../src/app/handlers/account-mcp-servers.ts', () => ({
	mutateAccountMcpServers: state.mutate,
}))
vi.mock('../../src/app/handlers/account-email-destinations.ts', () => ({
	mutateAccountEmailDestinations: state.mutate,
}))
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))
vi.mock('../../src/app/operation-result.ts', () => ({
	requireOperationResult: (result: { value: unknown }) => result.value,
}))
import {
	updateJobs,
	updateWorkflows,
	updateSecretProviders,
	updateIntegrations,
	updateConnections,
	updateMcpServers,
	updateEmailDestinations,
} from './account-mutations.ts'

test('mutations preserve the authenticated POST request instead of manufacturing destination GET requests', async () => {
	for (const mutate of [
		updateJobs,
		updateWorkflows,
		updateSecretProviders,
		updateIntegrations,
		updateConnections,
		updateMcpServers,
		updateEmailDestinations,
	]) {
		state.mutate.mockClear()
		await mutate({
			data: {
				orgSlug: 'acme',
				body: { action: 'test' },
				search: '?ignored=destination',
			},
		})
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({ request: state.request }),
		)
	}
})

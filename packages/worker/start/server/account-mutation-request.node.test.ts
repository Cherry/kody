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
	setAccountJobKillSwitch: state.mutate,
	runAccountJobNow: state.mutate,
}))
vi.mock('../../src/app/handlers/account-workflows.ts', () => ({
	cancelAccountWorkflowRun: state.mutate,
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
vi.mock('../../src/app/handlers/account-experiments.ts', () => ({ saveExperimentsPreference: state.mutate }))
import {
	updateExperiments,	setJobKillSwitch,
	runJobNow,
	cancelWorkflowRun,
	updateSecretProviders,
	updateIntegrations,
	updateConnections,
	updateMcpServers,
	updateEmailDestinations,
} from './account-mutations.ts'

test('mutations preserve the authenticated POST request instead of manufacturing destination GET requests', async () => {
	for (const mutate of [
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

test('job and workflow operations pass validated named fields with original request', async () => {
	for (const [operation, data] of [
		[runJobNow, { orgSlug: 'acme', id: 'job' }],
		[cancelWorkflowRun, { orgSlug: 'acme', id: 'run' }],
	] as const) {
		state.mutate.mockClear()
		await operation({ data })
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({ id: data.id, request: state.request }),
		)
		expect(state.mutate).not.toHaveBeenCalledWith(
			expect.objectContaining({ body: expect.anything() }),
		)
	}
	state.mutate.mockClear()
	await setJobKillSwitch({
		data: { orgSlug: 'acme', id: 'job', killSwitchEnabled: true },
	})
	expect(state.mutate).toHaveBeenCalledWith(
		expect.objectContaining({
			id: 'job',
			killSwitchEnabled: true,
			request: state.request,
		}),
	)
})


test('experiments preference rejects untyped input before the domain write', async () => {
	state.mutate.mockClear()
	expect(() => updateExperiments({ data: { experimentsOptIn: 'true' } as never })).toThrow()
	expect(state.mutate).not.toHaveBeenCalled()
	await updateExperiments({ data: { experimentsOptIn: false } })
	expect(state.mutate).toHaveBeenCalledWith(expect.objectContaining({ experimentsOptIn: false, request: state.request }))
})

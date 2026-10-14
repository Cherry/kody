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
	bindAccountSecretProvider: state.mutate,
	unbindAccountSecretProvider: state.mutate,
	grantAccountSecretProvider: state.mutate,
	revokeAccountSecretProvider: state.mutate,
}))
vi.mock('../../src/app/handlers/account-integrations.ts', () => ({
	mutateAccountIntegrations: state.mutate,
}))
vi.mock('../../src/app/handlers/account-connections.ts', () => ({
	disconnectAccountProvider: state.mutate,
	syncAccountDiscordRole: state.mutate,
}))
vi.mock('../../src/app/handlers/account-mcp-servers.ts', () => ({
	mutateAccountMcpServers: state.mutate,
}))
vi.mock('../../src/app/handlers/account-email-destinations.ts', () => ({
	addAccountEmailDestination: state.mutate,
	resendAccountEmailDestination: state.mutate,
	setDefaultAccountEmailDestination: state.mutate,
	removeAccountEmailDestination: state.mutate,
}))
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }))
vi.mock('../../src/app/operation-result.ts', () => ({
	requireOperationResult: (result: { value: unknown }) => result.value,
}))
vi.mock('../../src/app/handlers/account-experiments.ts', () => ({
	saveExperimentsPreference: state.mutate,
}))
import {
	updateExperiments,
	disconnectAccountProvider,
	syncDiscordMemberRole,
	setJobKillSwitch,
	runJobNow,
	cancelWorkflowRun,
	bindSecretProvider,
	unbindSecretProvider,
	grantSecretProvider,
	revokeSecretProvider,
	updateIntegrations,
	updateMcpServers,
} from './account-mutations.ts'

test('mutations preserve the authenticated POST request instead of manufacturing destination GET requests', async () => {
	for (const mutate of [updateIntegrations, updateMcpServers]) {
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
	expect(() =>
		updateExperiments({ data: { experimentsOptIn: 'true' } as never }),
	).toThrow()
	expect(state.mutate).not.toHaveBeenCalled()
	await updateExperiments({ data: { experimentsOptIn: false } })
	expect(state.mutate).toHaveBeenCalledWith(
		expect.objectContaining({
			experimentsOptIn: false,
			request: state.request,
		}),
	)
})

test('provider operations pass named fields and preserve original request and bind origin', async () => {
	for (const operation of [grantSecretProvider, revokeSecretProvider]) {
		state.mutate.mockClear()
		await operation({
			data: {
				orgSlug: 'acme',
				provider: '1password',
				packageId: 'pkg',
				ref: 'op://vault/item',
			},
		})
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				request: state.request,
				provider: '1password',
				packageId: 'pkg',
				ref: 'op://vault/item',
			}),
		)
	}
	await unbindSecretProvider({
		data: { orgSlug: 'acme', provider: '1password' },
	})
	await bindSecretProvider({
		data: {
			orgSlug: 'acme',
			provider: '1password',
			packageId: 'pkg',
			doorSecretName: 'TOKEN',
			config: { host: 'https://connect.test' },
		},
	})
	expect(state.mutate).toHaveBeenLastCalledWith(
		expect.objectContaining({
			request: state.request,
			requestUrl: state.request.url,
			doorSecretName: 'TOKEN',
			config: { host: 'https://connect.test' },
		}),
	)
})

test('email destination operations accept named fields and preserve original person context', async () => {
	const {
		addEmailDestination,
		resendEmailDestination,
		setDefaultEmailDestination,
		removeEmailDestination,
	} = await import('./account-mutations.ts')
	await addEmailDestination({ data: { email: 'person@example.com' } })
	expect(state.mutate).toHaveBeenLastCalledWith(
		expect.objectContaining({
			request: state.request,
			email: 'person@example.com',
		}),
	)
	for (const operation of [
		resendEmailDestination,
		setDefaultEmailDestination,
		removeEmailDestination,
	]) {
		await operation({ data: { destinationId: 'destination' } })
		expect(state.mutate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				request: state.request,
				destinationId: 'destination',
			}),
		)
	}
	expect(() => addEmailDestination({ data: { email: '' } })).toThrow()
})

test('connection operations preserve audit request and use named provider input', async () => {
	state.mutate.mockClear()
	await disconnectAccountProvider({ data: { provider: 'discord' } })
	expect(state.mutate).toHaveBeenCalledWith(
		expect.objectContaining({ request: state.request, provider: 'discord' }),
	)
	state.mutate.mockClear()
	await syncDiscordMemberRole({ data: {} })
	expect(state.mutate).toHaveBeenCalledWith(
		expect.objectContaining({ request: state.request }),
	)
})

test('provider mutation validation rejects non-string configuration before domain work', () => {
	state.mutate.mockClear()
	expect(() =>
		bindSecretProvider({
			data: {
				provider: '1password',
				packageId: 'pkg',
				doorSecretName: 'TOKEN',
				config: { host: 42 },
			} as never,
		}),
	).toThrow()
	expect(state.mutate).not.toHaveBeenCalled()
})

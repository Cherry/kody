import { connectSecretsSchema } from '../connect-input.ts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const saveProfile = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			displayName: z.string(),
			bio: z.string(),
			profileVisibility: z.enum(['public', 'private']),
		}),
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({}, async (context) => {
			const { saveAccountProfile } =
				await import('../../src/app/handlers/account-profile.ts')
			return saveAccountProfile({ ...context, body: data })
		})
	})

const resourceInput = z.object({
	orgSlug: z
		.string()
		.regex(/^[a-zA-Z0-9_-]+$/)
		.optional(),
	search: z.string().default(''),
})
export const updateSecrets = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			body: z.record(z.string(), z.unknown()),
			refresh: connectSecretsSchema
				.pick({ selectedSecretId: true, approval: true })
				.default({
					selectedSecretId: null,
					approval: { hosts: [], names: [], scope: 'user' },
				}),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountSecrets },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secrets.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountSecrets({
						...context,
						refresh: data.refresh,
						body: data.body,
					}),
				)
			},
		)
	})

export const deleteAccountValue = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ name: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountValues },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-values.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) =>
				requireOperationResult(
					await mutateAccountValues({
						...context,
						body: { action: 'delete', name: data.name },
					}),
				),
		)
	})
export const deleteAccountMemory = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			refresh: z.object({
				query: z.string(),
				includeDeleted: z.boolean(),
				selectedMemoryId: z.string().nullable(),
			}),
			memoryId: z.string().trim().min(1),
			force: z.boolean(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountMemories },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-memories.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountMemories({
						...context,
						refresh: data.refresh,
						body: {
							action: 'delete',
							memoryId: data.memoryId,
							force: data.force,
						},
					}),
				)
			},
		)
	})

export const setJobKillSwitch = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ id: z.string().trim().min(1), killSwitchEnabled: z.boolean() }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setAccountJobKillSwitch },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-jobs.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				const result = requireOperationResult(
					await setAccountJobKillSwitch({
						...context,
						id: data.id,
						killSwitchEnabled: data.killSwitchEnabled,
					}),
				)
				const { readJsonRecord } = await import('./json-value.ts')
				return {
					...result,
					selectedJob: result.selectedJob
						? {
								...result.selectedJob,
								params: result.selectedJob.params
									? readJsonRecord(result.selectedJob.params)
									: null,
							}
						: null,
				}
			},
		)
	})

export const runJobNow = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ id: z.string().trim().min(1) }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ runAccountJobNow },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-jobs.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				const result = requireOperationResult(
					await runAccountJobNow({ ...context, id: data.id }),
				)
				const { readJsonRecord } = await import('./json-value.ts')
				return {
					...result,
					selectedJob: result.selectedJob
						? {
								...result.selectedJob,
								params: result.selectedJob.params
									? readJsonRecord(result.selectedJob.params)
									: null,
							}
						: null,
				}
			},
		)
	})

export const cancelWorkflowRun = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ id: z.string().trim().min(1) }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ cancelAccountWorkflowRun },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-workflows.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				const result = requireOperationResult(
					await cancelAccountWorkflowRun({ ...context, id: data.id }),
				)
				return result
			},
		)
	})
export const updateSecretProviders = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountSecretProviders },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secret-providers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountSecretProviders({
						...context,
						body: data.body,
					}),
				)
			},
		)
	})

export const updateIntegrations = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountIntegrations },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountIntegrations({
						...context,
						body: data.body,
					}),
				)
			},
		)
	})

export const updateConnections = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountConnections },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connections.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountConnections({
						...context,
						body: data.body,
					}),
				)
			},
		)
	})

export const updateMcpServers = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountMcpServers },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountMcpServers({
						...context,
						body: data.body,
					}),
				)
			},
		)
	})

export const updateEmail = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			body: z.record(z.string(), z.unknown()),
			refresh: z.object({
				query: z.string(),
				classification: z.enum(['accepted', 'quarantined']).nullable(),
				page: z.number().int().positive(),
				pageSize: z.number().int().positive().max(100),
			}),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountEmail },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				const result = requireOperationResult(
					await mutateAccountEmail({
						...context,
						refresh: data.refresh,
						body: data.body,
					}),
				)
				const { readJsonRecord } = await import('./json-value.ts')
				return {
					...result,
					selectedMessage: result.selectedMessage
						? {
								...result.selectedMessage,
								headers: result.selectedMessage.headers
									? readJsonRecord(result.selectedMessage.headers)
									: null,
							}
						: null,
				}
			},
		)
	})

export const updateEmailDestinations = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountEmailDestinations },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email-destinations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				const result = await mutateAccountEmailDestinations({
					...context,
					body: data.body,
				})
				const { setResponseHeader } =
					await import('@tanstack/react-start/server')
				new Headers(result.headers).forEach((value, key) =>
					setResponseHeader(key, value),
				)
				return requireOperationResult(result)
			},
		)
	})

export const updateAvatar = createServerFn({ method: 'POST' })
	.validator((data: FormData) => {
		if (!(data instanceof FormData))
			throw new Error('Expected avatar form data.')
		const avatar = data.get('avatar')
		if (data.get('remove') !== 'true' && !(avatar instanceof File))
			throw new Error('Avatar file is required.')
		return data
	})
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { updateAccountAvatar }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/app/handlers/account-avatar.ts'),
			])
		return withWebsiteMutation({}, (context) =>
			updateAccountAvatar({
				...context,
				avatar:
					data.get('remove') === 'true' ? null : (data.get('avatar') as File),
			}),
		)
	})

export const updateConnectedAgents = createServerFn({ method: 'POST' })
	.validator(resourceInput.extend({ body: z.record(z.string(), z.unknown()) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountConnectedAgents },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connected-agents.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug
					? { orgSlug: data.orgSlug, requireMembership: false }
					: undefined,
			},
			async (context) =>
				requireOperationResult(
					await mutateAccountConnectedAgents({ ...context, body: data.body }),
				),
		)
	})

export const continueMcpAuthorization = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z.string().regex(/^[a-zA-Z0-9_-]+$/),
			serverId: z.string().min(1),
			token: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ loadConsentContext, isConsentRefusal, continueMcpServerAuthorization },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/org-mcp-server-authorize.ts'),
		])
		return withWebsiteMutation(
			{ scope: { orgSlug: data.orgSlug, requireMembership: false } },
			async (context) => {
				const consent = await loadConsentContext({
					...context,
					params: { orgSlug: data.orgSlug, serverId: data.serverId },
				})
				if (isConsentRefusal(consent))
					throw new Error(
						consent.kind === 'signed-out'
							? 'Please sign in again.'
							: consent.title,
					)
				return (
					await continueMcpServerAuthorization({
						env: context.env,
						context: consent,
						token: data.token,
					})
				).data
			},
		)
	})
export const recordWaitingClick = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			cardId: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ sanitizeWaitingCardId },
			{ recordOnboardingFunnelEvent },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('#universal/onboarding-funnel.ts'),
			import('#worker/identity/onboarding-funnel.ts'),
		])
		const cardId = sanitizeWaitingCardId(data.cardId)
		if (!cardId) throw new Error('Unknown card.')
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async ({ env, user }) => {
				recordOnboardingFunnelEvent(env, {
					stage: 'waiting_card_clicked',
					userId: user.mcpUser.userId,
					dimension: cardId,
				})
				return { ok: true }
			},
		)
	})
export const updateSecretCollection = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			body: z.record(z.string(), z.unknown()),
			refresh: connectSecretsSchema
				.pick({ selectedSecretId: true, approval: true })
				.default({
					selectedSecretId: null,
					approval: { hosts: [], names: [], scope: 'user' },
				}),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ mutateAccountSecretCollection },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secrets.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{
				scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined,
			},
			async (context) => {
				return requireOperationResult(
					await mutateAccountSecretCollection({
						...context,
						refresh: data.refresh,
						body: data.body,
					}),
				)
			},
		)
	})

export const updateExperiments = createServerFn({ method: 'POST' })
	.validator(z.object({ experimentsOptIn: z.boolean() }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ saveExperimentsPreference },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-experiments.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(
				await saveExperimentsPreference({
					...context,
					experimentsOptIn: data.experimentsOptIn,
				}),
			),
		)
	})

export const createMcpOauthClient = createServerFn({ method: 'POST' })
	.validator(z.object({ label: z.string(), redirectUris: z.string() }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ createAccountMcpOauthClient },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-oauth-clients.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(
				await createAccountMcpOauthClient({ ...context, ...data }),
			),
		)
	})

export const revokeMcpOauthClient = createServerFn({ method: 'POST' })
	.validator(z.object({ id: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ revokeAccountMcpOauthClient },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-oauth-clients.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(
				await revokeAccountMcpOauthClient({ ...context, ...data }),
			),
		)
	})

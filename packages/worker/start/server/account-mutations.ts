import {
	rotateOauthAppCredentialsSchema,
	disconnectConnectionSchema,
	deleteOauthAppSchema,
	setUsageSchema,
	approvePackageSchema,
} from '#universal/integration-mutations.ts'
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
			{ deleteAccountValueRecord },
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
					await deleteAccountValueRecord({
						...context,
						name: data.name,
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
			{ deleteAccountMemoryRecord },
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
					await deleteAccountMemoryRecord({
						...context,
						refresh: data.refresh,
						memoryId: data.memoryId,
						force: data.force,
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
export const bindSecretProvider = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			provider: z.string(),
			packageId: z.string(),
			doorSecretName: z.string(),
			config: z.record(z.string(), z.string()).default({}),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ bindAccountSecretProvider },
			{ requireOperationResult, operationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secret-providers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				try {
					return requireOperationResult(
						await bindAccountSecretProvider({
							...context,
							...data,
							requestUrl: context.request.url,
						}),
					)
				} catch (error) {
					return requireOperationResult(
						operationResult(
							{
								ok: false,
								error:
									error instanceof Error
										? error.message
										: 'Unable to update secret providers.',
							},
							400,
						),
					)
				}
			},
		)
	})

export const unbindSecretProvider = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			provider: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ unbindAccountSecretProvider },
			{ requireOperationResult, operationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secret-providers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				try {
					return requireOperationResult(
						await unbindAccountSecretProvider({
							...context,
							...data,
						}),
					)
				} catch (error) {
					return requireOperationResult(
						operationResult(
							{
								ok: false,
								error:
									error instanceof Error
										? error.message
										: 'Unable to update secret providers.',
							},
							400,
						),
					)
				}
			},
		)
	})

export const grantSecretProvider = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			provider: z.string(),
			packageId: z.string(),
			ref: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ grantAccountSecretProvider },
			{ requireOperationResult, operationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secret-providers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				try {
					return requireOperationResult(
						await grantAccountSecretProvider({
							...context,
							...data,
						}),
					)
				} catch (error) {
					return requireOperationResult(
						operationResult(
							{
								ok: false,
								error:
									error instanceof Error
										? error.message
										: 'Unable to update secret providers.',
							},
							400,
						),
					)
				}
			},
		)
	})

export const revokeSecretProvider = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			provider: z.string(),
			packageId: z.string(),
			ref: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ revokeAccountSecretProvider },
			{ requireOperationResult, operationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-secret-providers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) => {
				try {
					return requireOperationResult(
						await revokeAccountSecretProvider({
							...context,
							...data,
						}),
					)
				} catch (error) {
					return requireOperationResult(
						operationResult(
							{
								ok: false,
								error:
									error instanceof Error
										? error.message
										: 'Unable to update secret providers.',
							},
							400,
						),
					)
				}
			},
		)
	})

export const rotateOauthAppCredentials = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			input: rotateOauthAppCredentialsSchema,
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ rotateAccountOauthAppCredentials },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		const input = data.input
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await rotateAccountOauthAppCredentials({ ...context, ...input }),
				),
		)
	})

export const disconnectIntegration = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			input: disconnectConnectionSchema,
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ disconnectAccountIntegration },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		const input = data.input
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await disconnectAccountIntegration({ ...context, name: input.name }),
				),
		)
	})

export const deleteOauthApp = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			input: deleteOauthAppSchema,
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ deleteAccountOauthApp },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		const input = data.input
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await deleteAccountOauthApp({ ...context, appSlug: input.appSlug }),
				),
		)
	})

export const setIntegrationUsage = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			input: setUsageSchema,
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setAccountIntegrationUsage },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		const input = data.input
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await setAccountIntegrationUsage({ ...context, ...input }),
				),
		)
	})

export const approveIntegrationPackage = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			input: approvePackageSchema,
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ approveAccountIntegrationPackage },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-integrations.ts'),
			import('../../src/app/operation-result.ts'),
		])
		const input = data.input
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await approveAccountIntegrationPackage({ ...context, ...input }),
				),
		)
	})
export const disconnectAccountProvider = createServerFn({ method: 'POST' })
	.validator(
		z.object({ provider: z.enum(['github', 'google', 'x', 'discord']) }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ disconnectAccountProvider: operation },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connections.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(
				await operation({ ...context, provider: data.provider }),
			),
		)
	})

export const syncDiscordMemberRole = createServerFn({ method: 'POST' })
	.validator(z.object({}))
	.handler(async () => {
		const [
			{ withWebsiteMutation },
			{ syncAccountDiscordRole: operation },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connections.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation({}, async (context) =>
			requireOperationResult(await operation({ ...context })),
		)
	})
export const addMcpServer = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			name: z.string(),
			url: z.string(),
			bearerToken: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ addAccountMcpServer },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await addAccountMcpServer({ ...context, ...data }),
				),
		)
	})

export const reconnectMcpServer = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ reconnectAccountMcpServer },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await reconnectAccountMcpServer({ ...context, ...data }),
				),
		)
	})

export const refreshMcpServer = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ refreshAccountMcpServer },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await refreshAccountMcpServer({ ...context, ...data }),
				),
		)
	})

export const setMcpServerEnabled = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
			enabled: z.boolean(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setAccountMcpServerEnabled },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await setAccountMcpServerEnabled({ ...context, ...data }),
				),
		)
	})

export const setMcpServerUsage = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
			usageMode: z.enum(['any', 'packages']),
			allowedPackageIds: z.array(z.string()),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setAccountMcpServerUsage },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await setAccountMcpServerUsage({ ...context, ...data }),
				),
		)
	})

export const deleteMcpServer = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ deleteAccountMcpServer },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await deleteAccountMcpServer({ ...context, ...data }),
				),
		)
	})

export const setMcpServerOAuthClient = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
			clientId: z.string(),
			clientSecret: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setAccountMcpServerOAuthClient },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await setAccountMcpServerOAuthClient({ ...context, ...data }),
				),
		)
	})

export const removeMcpServerOAuthClient = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			orgSlug: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			id: z.string(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ removeAccountMcpServerOAuthClient },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-mcp-servers.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await removeAccountMcpServerOAuthClient({ ...context, ...data }),
				),
		)
	})

export const deleteEmailMessage = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			messageId: z.string().trim().min(1),
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
			{ deleteAccountEmailMessage },
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
					await deleteAccountEmailMessage({
						...context,
						refresh: data.refresh,
						messageId: data.messageId,
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

export const classifyEmailMessage = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			messageId: z.string().trim().min(1),
			classification: z.enum(['accepted', 'quarantined']),
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
			{ classifyAccountEmailMessage },
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
					await classifyAccountEmailMessage({
						...context,
						refresh: data.refresh,
						messageId: data.messageId,
						classification: data.classification,
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

export const addEmailDestination = createServerFn({ method: 'POST' })
	.validator(z.object({ email: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ addAccountEmailDestination },
			{ requireOperationResult },
			{ setResponseHeader },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email-destinations.ts'),
			import('../../src/app/operation-result.ts'),
			import('@tanstack/react-start/server'),
		])
		return withWebsiteMutation({}, async (context) => {
			const result = await addAccountEmailDestination({
				...context,
				email: data.email,
			})
			new Headers(result.headers).forEach((value, key) =>
				setResponseHeader(key, value),
			)
			return requireOperationResult(result)
		})
	})

export const resendEmailDestination = createServerFn({ method: 'POST' })
	.validator(z.object({ destinationId: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ resendAccountEmailDestination },
			{ requireOperationResult },
			{ setResponseHeader },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email-destinations.ts'),
			import('../../src/app/operation-result.ts'),
			import('@tanstack/react-start/server'),
		])
		return withWebsiteMutation({}, async (context) => {
			const result = await resendAccountEmailDestination({
				...context,
				destinationId: data.destinationId,
			})
			new Headers(result.headers).forEach((value, key) =>
				setResponseHeader(key, value),
			)
			return requireOperationResult(result)
		})
	})

export const setDefaultEmailDestination = createServerFn({ method: 'POST' })
	.validator(z.object({ destinationId: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ setDefaultAccountEmailDestination },
			{ requireOperationResult },
			{ setResponseHeader },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email-destinations.ts'),
			import('../../src/app/operation-result.ts'),
			import('@tanstack/react-start/server'),
		])
		return withWebsiteMutation({}, async (context) => {
			const result = await setDefaultAccountEmailDestination({
				...context,
				destinationId: data.destinationId,
			})
			new Headers(result.headers).forEach((value, key) =>
				setResponseHeader(key, value),
			)
			return requireOperationResult(result)
		})
	})

export const removeEmailDestination = createServerFn({ method: 'POST' })
	.validator(z.object({ destinationId: z.string().trim().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ removeAccountEmailDestination },
			{ requireOperationResult },
			{ setResponseHeader },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-email-destinations.ts'),
			import('../../src/app/operation-result.ts'),
			import('@tanstack/react-start/server'),
		])
		return withWebsiteMutation({}, async (context) => {
			const result = await removeAccountEmailDestination({
				...context,
				destinationId: data.destinationId,
			})
			new Headers(result.headers).forEach((value, key) =>
				setResponseHeader(key, value),
			)
			return requireOperationResult(result)
		})
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

const profileGrants = z.array(
	z.object({
		resourceType: z.literal('package'),
		resourceId: z.string(),
		actions: z.array(z.enum(['read', 'execute'])),
	}),
)
export const revokeConnectedAgent = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ clientId: z.string().trim().min(1) }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ revokeAccountConnectedAgent },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connected-agents.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await revokeAccountConnectedAgent({
						...context,
						clientId: data.clientId,
					}),
				),
		)
	})

export const createConnectionProfile = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ name: z.string(), grants: profileGrants }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ createConnectedAgentProfile },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connected-agents.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await createConnectedAgentProfile({
						...context,
						name: data.name,
						grants: data.grants,
					}),
				),
		)
	})

export const updateConnectionProfile = createServerFn({ method: 'POST' })
	.validator(
		resourceInput.omit({ search: true }).extend({
			profileId: z.string().trim().min(1),
			name: z.string().optional(),
			grants: profileGrants.optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ updateConnectedAgentProfile },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connected-agents.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await updateConnectedAgentProfile({
						...context,
						profileId: data.profileId,
						name: data.name,
						grants: data.grants,
					}),
				),
		)
	})

export const deleteConnectionProfile = createServerFn({ method: 'POST' })
	.validator(
		resourceInput
			.omit({ search: true })
			.extend({ profileId: z.string().trim().min(1) }),
	)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteMutation },
			{ deleteConnectedAgentProfile },
			{ requireOperationResult },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/handlers/account-connected-agents.ts'),
			import('../../src/app/operation-result.ts'),
		])
		return withWebsiteMutation(
			{ scope: data.orgSlug ? { orgSlug: data.orgSlug } : undefined },
			async (context) =>
				requireOperationResult(
					await deleteConnectedAgentProfile({
						...context,
						profileId: data.profileId,
					}),
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

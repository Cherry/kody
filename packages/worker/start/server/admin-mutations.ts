import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const saveAdminFeatureFlags = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminFeatureFlags }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/feature-flags-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/feature-flags', request.url)
			url.search = data.search ?? ''
			return mutateAdminFeatureFlags({ env, request, url, body: data.body })
		})
	})

export const saveAdminReservedUsernames = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminReservedUsernames }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/reserved-usernames-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/reserved-usernames', request.url)
			url.search = data.search ?? ''
			return mutateAdminReservedUsernames({
				env,
				request,
				url,
				body: data.body,
			})
		})
	})

export const saveAdminProviderMarks = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminProviderMarks }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/provider-marks-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/provider-marks', request.url)
			url.search = data.search ?? ''
			return mutateAdminProviderMarks({ env, request, url, body: data.body })
		})
	})

export const saveAdminPlatformIntegrations = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminPlatformIntegrations }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/platform-integrations-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/platform-integrations', request.url)
			url.search = data.search ?? ''
			return mutateAdminPlatformIntegrations({
				env,
				request,
				url,
				body: data.body,
			})
		})
	})

export const saveAdminCommunityReports = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminCommunityReports }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/community-reports-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/community-reports', request.url)
			url.search = data.search ?? ''
			return mutateAdminCommunityReports({ env, request, url, body: data.body })
		})
	})

export const saveAdminSystemEmail = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminSystemEmail }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/system-email-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/system-email', request.url)
			url.search = data.search ?? ''
			return mutateAdminSystemEmail({ env, request, url, body: data.body })
		})
	})

export const saveAdminUsers = createServerFn({ method: 'POST' })
	.inputValidator(
		z.object({
			body: z.record(z.string(), z.unknown()),
			search: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutateAdminUsers }] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/admin/users-operations.ts'),
		])
		return withWebsiteMutation({}, async ({ request, env }) => {
			const url = new URL('/admin/users', request.url)
			url.search = data.search ?? ''
			return mutateAdminUsers({ env, request, url, body: data.body })
		})
	})

export const adminCodemodRun = createServerFn({ method: 'POST' })
	.inputValidator(z.record(z.string(), z.unknown()))
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { adminCodemodsRun }] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/admin/codemods-operations.ts'),
		])
		return withWebsiteMutation({}, async ({ request, env }) =>
			adminCodemodsRun({
				env,
				request,
				url: new URL('/admin/codemods', request.url),
				body: data,
			}),
		)
	})

export const adminCodemodRunStop = createServerFn({ method: 'POST' })
	.inputValidator(z.record(z.string(), z.unknown()))
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { adminCodemodsRunStop }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/admin/codemods-operations.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env }) =>
			adminCodemodsRunStop({
				env,
				request,
				url: new URL('/admin/codemods', request.url),
				body: data,
			}),
		)
	})

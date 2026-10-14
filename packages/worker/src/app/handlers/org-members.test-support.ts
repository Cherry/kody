import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { resolveOrgManagementAccess } from '#app/org-management-access.ts'
import {
	loadOrgMembersData,
	mutateOrgMembersInvite,
	mutateOrgMembersInviteLinks,
	mutateOrgMembersInviteLinksRevoke,
	mutateOrgMembersRemove,
	mutateOrgMembersRole,
	readJsonObject,
} from './org-members.ts'
export * from './org-members.ts'
export function testOrgMembersApiHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			}
			const access = await resolveOrgManagementAccess({
				request,
				env,
				user,
				permission: 'member:read',
			})
			if (!access.ok) {
				return operationResult(
					{ ok: false, error: access.error },
					access.status,
				)
			}
			return operationResult(
				await loadOrgMembersData({ env, user, org: access.org }),
			)
		},
	}
}

export function testOrgMembersRolePostHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user)
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			const body = (await readJsonObject(request)) ?? {}
			const result = await mutateOrgMembersRole({ request, env, user, body })
			return operationResult(result.data, result.status)
		},
	}
}

export function testOrgMembersRemovePostHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user)
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			const body = (await readJsonObject(request)) ?? {}
			const result = await mutateOrgMembersRemove({ request, env, user, body })
			return operationResult(result.data, result.status)
		},
	}
}

export function testOrgMembersInvitePostHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user)
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			const body = (await readJsonObject(request)) ?? {}
			const result = await mutateOrgMembersInvite({ request, env, user, body })
			return operationResult(result.data, result.status)
		},
	}
}

export function testOrgMembersInviteLinksPostHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user)
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			const body = (await readJsonObject(request)) ?? {}
			const result = await mutateOrgMembersInviteLinks({
				request,
				env,
				user,
				body,
			})
			return operationResult(result.data, result.status)
		},
	}
}

export function testOrgMembersInviteLinksRevokePostHandler(env: Env) {
	return {
		async execute({ request }: { request: Request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user)
				return operationResult({ ok: false, error: 'Unauthorized.' }, 401)
			const body = (await readJsonObject(request)) ?? {}
			const result = await mutateOrgMembersInviteLinksRevoke({
				request,
				env,
				user,
				body,
			})
			return operationResult(result.data, result.status)
		},
	}
}

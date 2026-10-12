import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'

async function orgContext(slug: string, section: string) {
	const [
		{ env },
		{ getRequest, setResponseHeader },
		{ getEnv },
		{ setAuthSessionSecret },
		{ requireAuthenticatedPageUser },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('@tanstack/react-start/server'),
		import('../../src/app/env.ts'),
		import('../../src/app/auth-session.ts'),
		import('../../src/app/page-auth.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const request = new Request(
		new URL(`/@${encodeURIComponent(slug)}/-/${section}`, getRequest().url),
		{ headers: getRequest().headers },
	)
	setResponseHeader('Cache-Control', 'no-store')
	const user = await requireAuthenticatedPageUser(request, bindings)
	if (user instanceof Response) {
		const cookies = user.headers.getSetCookie()
		if (cookies.length) setResponseHeader('Set-Cookie', cookies)
		throw redirect({ href: user.headers.get('Location') ?? '/login' })
	}
	return { env: bindings, request, user }
}
const slugInput = z.object({ slug: z.string().regex(/^[a-zA-Z0-9_-]+$/) })

export const loadOrgMembers = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'members')
		const [
			{ resolveOrgManagementAccess },
			{ loadOrgMembersData },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-management-access.ts'),
			import('../../src/app/handlers/org-members.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const access = await resolveOrgManagementAccess({
			...input,
			permission: 'member:read',
		})
		if (!access.ok) {
			if (access.status === 404) throw notFound()
			throw new Response(access.error, { status: 403 })
		}
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug: access.org.slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return loadOrgMembersData({ ...input, org: access.org })
	})

export const loadOrgSettings = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'settings')
		const [
			{ resolveOrgManagementAccess },
			{ loadOrgSettingsData },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-management-access.ts'),
			import('../../src/app/handlers/org-settings.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const access = await resolveOrgManagementAccess({
			...input,
			permission: 'org:read',
		})
		if (!access.ok) {
			if (access.status === 404) throw notFound()
			throw new Response(access.error, { status: 403 })
		}
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug: access.org.slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return loadOrgSettingsData({ ...input, org: access.org })
	})

export const loadOrgTeams = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'teams')
		const [
			{ resolveOrgManagementAccess },
			{ loadOrgTeamsData },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-management-access.ts'),
			import('../../src/app/handlers/org-teams.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const access = await resolveOrgManagementAccess({
			...input,
			permission: 'team:read',
		})
		if (!access.ok) {
			if (access.status === 404) throw notFound()
			throw new Response(access.error, { status: 403 })
		}
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug: access.org.slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return loadOrgTeamsData({ ...input, org: access.org })
	})

export const loadOrgGrants = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'grants')
		const [
			{ resolveOrgManagementAccess },
			{ loadOrgGrantsData },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-management-access.ts'),
			import('../../src/app/handlers/org-grants.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const access = await resolveOrgManagementAccess({
			...input,
			permission: 'member:read',
		})
		if (!access.ok) {
			if (access.status === 404) throw notFound()
			throw new Response(access.error, { status: 403 })
		}
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug: access.org.slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return loadOrgGrantsData({ ...input, org: access.org })
	})

export const loadOrgCollaborators = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'collaborators')
		const [
			{ resolveOrgManagementAccess },
			{ loadOrgCollaboratorsData },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-management-access.ts'),
			import('../../src/app/handlers/org-collaborators.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const access = await resolveOrgManagementAccess({
			...input,
			permission: 'member:read',
		})
		if (!access.ok) {
			if (access.status === 404) throw notFound()
			throw new Response(access.error, { status: 403 })
		}
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug: access.org.slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return loadOrgCollaboratorsData({ ...input, org: access.org })
	})

export const loadOrgInvite = createServerFn({ method: 'GET' })
	.validator(z.object({ token: z.string().min(1) }))
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getEnv },
			{ getRequest, setResponseHeader },
			{ loadJoinPageData },
			{ setAuthSessionSecret },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/handlers/org-invite-join.ts'),
			import('../../src/app/auth-session.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		setResponseHeader('Cache-Control', 'no-store')
		return loadJoinPageData({
			env: bindings,
			request: getRequest(),
			token: data.token,
		})
	})

export const loadOrgOverview = createServerFn({ method: 'GET' })
	.validator(slugInput)
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'overview')
		const [
			{ loadRequestOrgResolution },
			{ personalOrgId },
			{ serializeLastUsedOrgCookie },
			{ isSecureRequest },
			{ setResponseHeader },
		] = await Promise.all([
			import('../../src/app/org-request-binding.ts'),
			import('@kody-internal/shared/owner-person-ids.ts'),
			import('#universal/org-last-used-cookie.ts'),
			import('../../src/app/auth-session.ts'),
			import('@tanstack/react-start/server'),
		])
		const resolution = await loadRequestOrgResolution(
			input.request,
			input.env,
			input.user.mcpUser.userId,
		)
		if (typeof resolution === 'string') throw notFound()
		const slug = resolution.org.slug ?? data.slug
		if (resolution.org.id !== personalOrgId(input.user.mcpUser.userId))
			throw redirect({ href: `/@${encodeURIComponent(slug)}` })
		setResponseHeader(
			'Set-Cookie',
			serializeLastUsedOrgCookie({
				slug,
				secure: isSecureRequest(input.request),
			}),
		)
		return { slug }
	})

export const loadOrgRepositories = createServerFn({ method: 'GET' })
	.validator(slugInput.extend({ search: z.string().default('') }))
	.handler(async ({ data }) => {
		const input = await orgContext(data.slug, 'packages')
		const [
			{ loadRequestOrgResolution, orgSectionDenial },
			{ personalOrgId },
			{ loadOrgRepositoriesData },
			{ loadProfileData },
		] = await Promise.all([
			import('../../src/app/org-request-binding.ts'),
			import('@kody-internal/shared/owner-person-ids.ts'),
			import('../../src/app/org-repositories-data.ts'),
			import('../../src/app/profile-data.ts'),
		])
		const binding = await loadRequestOrgResolution(
			input.request,
			input.env,
			input.user.mcpUser.userId,
		)
		if (typeof binding === 'string' || orgSectionDenial(binding, 'packages'))
			throw notFound()
		const url = new URL(input.request.url)
		const search = new URLSearchParams(data.search)
		for (const key of ['q', 'limit']) {
			const value = search.get(key)
			if (value !== null) url.searchParams.set(key, value)
		}
		const request = new Request(url, { headers: input.request.headers })
		const payload =
			binding.org.id === personalOrgId(input.user.mcpUser.userId)
				? await loadProfileData(input.env, request, input.user.username)
				: await loadOrgRepositoriesData({ ...input, request, binding })
		if (!payload) throw notFound()
		return payload
	})

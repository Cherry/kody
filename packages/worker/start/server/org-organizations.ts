import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'

async function accountContext() {
	const [
		{ env },
		{ getEnv },
		{ getRequest, setResponseHeader },
		{ setAuthSessionSecret },
		{ requireAuthenticatedPageUser },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('../../src/app/env.ts'),
		import('@tanstack/react-start/server'),
		import('../../src/app/auth-session.ts'),
		import('../../src/app/page-auth.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const request = new Request(
		new URL('/account/organizations', getRequest().url),
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
export const loadOrganizations = createServerFn({ method: 'GET' }).handler(
	async () => {
		const { env, request, user } = await accountContext()
		const { loadAccountOrganizationsData } =
			await import('../../src/app/handlers/account-organizations.ts')
		return loadAccountOrganizationsData(env, user, request)
	},
)
export const createOrg = createServerFn({ method: 'POST' })
	.validator(z.object({ displayName: z.string(), slug: z.string() }))
	.handler(async ({ data }) => {
		const { env, user } = await accountContext()
		const [
			{ authorize, AuthorizationError },
			{ createOrganization },
			{ orgAuditWriterFromRequest },
		] = await Promise.all([
			import('../../src/authorization/authorize.ts'),
			import('../../src/orgs/create-organization.ts'),
			import('../../src/orgs/org-audit.ts'),
		])
		try {
			await authorize({ env, request: user.request }, 'org:write')
		} catch (error) {
			if (error instanceof AuthorizationError)
				throw new Error('You do not have permission to create an organization.')
			throw error
		}
		const result = await createOrganization(env.APP_DB, env, {
			personId: user.mcpUser.userId,
			audit: orgAuditWriterFromRequest(env, user.request),
			...data,
		})
		if (!result.ok) throw new Error(result.error)
		return { slug: result.slug }
	})

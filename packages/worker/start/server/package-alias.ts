import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
export const loadAccountPackageAlias = createServerFn({ method: 'GET' })
	.validator(
		(data: { packageId: string; approval?: boolean; search: string }) => {
			if (
				!data ||
				typeof data.packageId !== 'string' ||
				!data.packageId ||
				typeof data.search !== 'string' ||
				(data.search !== '' && !data.search.startsWith('?')) ||
				(data.approval !== undefined && typeof data.approval !== 'boolean')
			)
				throw notFound()
			return data
		},
	)
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getEnv },
			{ getRequest, setResponseHeader },
			{ setAuthSessionSecret },
			{ requireAuthenticatedPageUser },
			{ getSavedPackageById },
			{ routes },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('@tanstack/react-start/server'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/package-registry/repo.ts'),
			import('../../universal/routes.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const path =
			routes.accountPackageDetail.href({ packageId: data.packageId }) +
			(data.approval ? '/approve-publish' : '')
		const user = await requireAuthenticatedPageUser(getRequest(), bindings, {
			redirectTo: path + data.search,
		})
		if (user instanceof Response) {
			const cookie = user.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			const location = user.headers.get('Location')
			if (location) throw redirect({ href: location, statusCode: user.status })
			throw notFound()
		}
		const saved = await getSavedPackageById(bindings.APP_DB, {
			userId: user.mcpUser.userId,
			packageId: data.packageId,
		})
		if (!saved) throw notFound()
		setResponseHeader('Cache-Control', 'private, no-store')
		throw redirect({
			href:
				routes.communityPackage.href({
					username: user.username,
					kodyId: saved.kodyId,
				}) +
				(data.approval ? '/approve-publish' : '') +
				data.search,
			statusCode: 302,
		})
	})

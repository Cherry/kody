import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadAdminUsers = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/users(?:\/[^/?#]+)?(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader, setResponseStatus },
			{ getEnv },
			{ setAuthSessionSecret },
			{ requirePageUserWithRole },
			{ loadAdminUsersData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/admin/users-data.ts'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const headers = new Headers(getRequest().headers)
		headers.set('Accept', 'text/html')
		const request = new Request(new URL(href, getRequest().url), { headers })
		const user = await requirePageUserWithRole(request, bindings, 'admin')
		if (user instanceof Response) {
			const cookie = user.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			const location = user.headers.get('Location')
			if (location) throw redirect({ href: location, statusCode: user.status })
			setResponseStatus(user.status)
			return {
				forbidden: true as const,
				head: loadDocumentHead(href),
			}
		}
		return {
			forbidden: false as const,
			payload: await loadAdminUsersData(
				bindings,
				(() => {
					const url = new URL(request.url)
					url.searchParams.delete('page')
					return url.toString()
				})(),
				new URL(request.url).pathname.split('/')[3],
			),
			head: loadDocumentHead(href),
		}
	})

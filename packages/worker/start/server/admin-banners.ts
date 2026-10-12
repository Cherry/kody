import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadAdminBanners = createServerFn({ method: 'GET' }).handler(
	async () => {
		const [
			{ env },
			{ getRequest, setResponseHeader, setResponseStatus },
			{ getEnv },
			{ setAuthSessionSecret },
			{ requirePageUserWithRole },
			{ loadAdminBannersData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/app/admin-banners-data.ts'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const headers = new Headers(getRequest().headers)
		headers.set('Accept', 'text/html')
		const request = new Request(new URL('/admin/banners', getRequest().url), {
			headers,
		})
		const user = await requirePageUserWithRole(request, bindings, 'admin')
		if (user instanceof Response) {
			const cookie = user.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			const location = user.headers.get('Location')
			if (location) throw redirect({ href: location, statusCode: user.status })
			setResponseStatus(user.status)
			return {
				forbidden: true as const,
				head: loadDocumentHead('/admin/banners'),
			}
		}
		return {
			forbidden: false as const,
			payload: await loadAdminBannersData(bindings),
			head: loadDocumentHead('/admin/banners'),
		}
	},
)

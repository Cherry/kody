import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'

export const loadConnectSecretSet = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/connect\/secret-set(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid secret setup URL.')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ requireAuthenticatedPageUser },
			{ loadAccountSecretsData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/app/account-secrets-data.ts'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const original = getRequest()
		const headers = new Headers(original.headers)
		const org = new URL(href, original.url).searchParams.get('org')?.trim()
		if (org)
			headers.set(
				'Referer',
				new URL(`/@${encodeURIComponent(org)}/-/secrets`, original.url).href,
			)
		// Authenticate the same org-bound request used to read the data.
		const request = new Request(
			new URL('/account/secrets.json', original.url),
			{ headers },
		)
		const user = await requireAuthenticatedPageUser(request, bindings, {
			redirectTo: href,
		})
		if (user instanceof Response) {
			const cookie = user.headers.get('Set-Cookie')
			if (cookie) setResponseHeader('Set-Cookie', cookie)
			throw redirect({
				href: user.headers.get('Location') ?? '/login',
				statusCode: user.status,
			})
		}
		const { isOrgRequestDenied } =
			await import('../../src/app/org-request-binding.ts')
		if (await isOrgRequestDenied(request, bindings, user.mcpUser.userId))
			throw notFound()
		const payload = await loadAccountSecretsData({
			env: bindings,
			request,
			user,
		})
		return {
			payload,
			head: loadDocumentHead(
				'/connect/secret-set',
				{ accountSecrets: payload },
				new URL(href, original.url).search,
			),
		}
	})

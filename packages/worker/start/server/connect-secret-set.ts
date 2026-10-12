import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

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
		const user = await requireAuthenticatedPageUser(original, bindings, {
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
		// Setup prefill must not be interpreted as a host-approval query.
		const request = new Request(
			new URL('/account/secrets.json', original.url),
			{ headers: original.headers },
		)
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

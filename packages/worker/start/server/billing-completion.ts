import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadBillingCompletion = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/@[^/?#]+\/-\/billing\/success(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid checkout completion URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ completeOrgBillingCheckout },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/org-billing.ts'),
			import('./document-head.ts'),
		])
		if (getRequest().method !== 'GET')
			throw new Response(null, { status: 405, headers: { Allow: 'GET' } })
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const request = new Request(new URL(href, getRequest().url), {
			headers: getRequest().headers,
		})
		const result = await completeOrgBillingCheckout(request, bindings)
		if (result instanceof Response) {
			const cookies = result.headers.getSetCookie()
			if (cookies.length) setResponseHeader('Set-Cookie', cookies)
			throw redirect({
				href: result.headers.get('Location') ?? '/',
				statusCode: result.status,
			})
		}
		if (!result.ok) throw new Response(result.error, { status: result.status })
		return {
			payload: result,
			head: loadDocumentHead(new URL(request.url).pathname, {
				accountBillingSuccess: result,
			}),
		}
	})

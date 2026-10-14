import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadBillingCompletion = createServerFn({ method: 'GET' })
	.validator((data: { orgSlug: string; sessionId: string | null }) => {
		if (
			!data ||
			typeof data.orgSlug !== 'string' ||
			!/^[a-zA-Z0-9_-]+$/.test(data.orgSlug) ||
			(data.sessionId !== null && typeof data.sessionId !== 'string')
		)
			throw new Error('Invalid checkout completion input')
		return { orgSlug: data.orgSlug, sessionId: data.sessionId }
	})
	.handler(async ({ data }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader },
			{ getEnv },
			{ setAuthSessionSecret },
			{ completeOrgBillingCheckout },
			{ loadDocumentHead },
			{ requireAuthenticatedPageUser },
			{ loadOrgBindingForSlug },
			{ deriveRequestContext },
			{ orgBillingPath },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/org-billing.ts'),
			import('./document-head.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/orgs/repo.ts'),
			import('../../src/request-context/request-context.ts'),
			import('../../universal/org-pages.ts'),
		])
		if (getRequest().method !== 'GET')
			throw new Response(null, { status: 405, headers: { Allow: 'GET' } })
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		const request = getRequest()
		const pathname = `${orgBillingPath(data.orgSlug)}/success`
		const search = new URLSearchParams()
		if (data.sessionId !== null) search.set('session_id', data.sessionId)
		const href = pathname + (search.size ? `?${search}` : '')
		const { withAccountRequestWriteLease } =
			await import('../../src/app/account-write-lease-middleware.ts')
		const result = await withAccountRequestWriteLease(
			request,
			bindings,
			async () => {
				const authenticated = await requireAuthenticatedPageUser(
					request,
					bindings,
					{ redirectTo: href },
				)

				if (authenticated instanceof Response) return authenticated
				const binding = await loadOrgBindingForSlug(
					bindings.APP_DB,
					authenticated.mcpUser.userId,
					data.orgSlug,
				)
				if (!binding)
					return {
						ok: false as const,
						status: 404,
						error: 'Organization unavailable.',
					}
				const user = {
					...authenticated,
					request: deriveRequestContext({
						user: authenticated.mcpUser,
						source: { kind: 'session' },
						orgBinding: binding,
					}),
				}
				return completeOrgBillingCheckout({
					request,
					env: bindings,
					user,
					...data,
				})
			},
		)

		if (result instanceof Response) {
			const cookies = result.headers.getSetCookie()
			if (cookies.length) setResponseHeader('Set-Cookie', cookies)
			const location = result.headers.get('Location')
			if (!location) throw result
			throw redirect({
				href: location,
				statusCode: result.status,
			})
		}
		if (!result.ok) throw new Response(result.error, { status: result.status })
		return {
			payload: result,
			head: loadDocumentHead('orgBillingSuccess', pathname, {
				accountBillingSuccess: result,
			}),
		}
	})

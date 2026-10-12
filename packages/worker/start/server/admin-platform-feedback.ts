import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'

export const loadAdminPlatformFeedback = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/platform-feedback(?:\?[^#]*)?$/.test(href)
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
			{ loadAdminPlatformFeedbackData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/page-auth.ts'),
			import('../../src/app/admin-platform-feedback-data.ts'),
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
		const payload = await loadAdminPlatformFeedbackData(bindings, request.url)
		const { auditPlatformFeedbackRead } =
			await import('../../src/app/handlers/admin-platform-feedback.ts')
		const { readAdminPlatformFeedbackId } =
			await import('../../src/app/admin-platform-feedback-data.ts')
		const feedbackId = readAdminPlatformFeedbackId(
			new URL(request.url).searchParams.get('feedbackId'),
		)
		await auditPlatformFeedbackRead({
			env: bindings,
			request,
			actorEmail: user.email,
			action: feedbackId
				? 'adminPlatformFeedbackGet'
				: 'adminPlatformFeedbackList',
			feedbackId,
			notFound: feedbackId !== null && payload.selectedFeedback === null,
		})
		return {
			forbidden: false as const,
			payload,
			head: loadDocumentHead(
				new URL(request.url).pathname,
				undefined,
				new URL(request.url).search,
			),
		}
	})

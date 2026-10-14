import { createServerFn } from '@tanstack/react-start'

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
		const [{ loadAdminPlatformFeedbackData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/app/admin-platform-feedback-data.ts'),
				import('./document-head.ts'),
			])
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { bindings, request, url, user } = await readAdminPageContext(href)
		if (!user) {
			return {
				forbidden: true as const,
				head: loadDocumentHead(href),
			}
		}
		const payload = await loadAdminPlatformFeedbackData(bindings, url.href)
		const { auditPlatformFeedbackRead } =
			await import('../../src/admin/platform-feedback-operations.ts')
		const { readAdminPlatformFeedbackId } =
			await import('../../src/app/admin-platform-feedback-data.ts')
		const feedbackId = readAdminPlatformFeedbackId(
			url.searchParams.get('feedbackId'),
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
			head: loadDocumentHead(url.pathname, undefined, url.search),
		}
	})

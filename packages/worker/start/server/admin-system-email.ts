import { createServerFn } from '@tanstack/react-start'

export const loadAdminSystemEmail = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!/^\/admin\/system-email(?:\?[^#]*)?$/.test(href)
		)
			throw new Error('Invalid users URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [{ loadAdminSystemEmailData }, { loadDocumentHead }] =
			await Promise.all([
				import('../../src/admin/system-email-data.ts'),
				import('./document-head.ts'),
			])
		const { readAdminPageContext } = await import('./admin-page-context.ts')
		const { bindings, request, url, user } = await readAdminPageContext(href)
		if (!user) {
			return {
				forbidden: true as const,
				head: loadDocumentHead('adminSystemEmail', href),
			}
		}
		const payload = await loadAdminSystemEmailData(bindings, url.href)
		const { auditSystemEmailAccess } =
			await import('../../src/admin/system-email-operations.ts')
		await auditSystemEmailAccess({
			env: bindings,
			request,
			actorEmail: user.email,
			action: payload.selectedMessage
				? 'adminSystemEmailGet'
				: 'adminSystemEmailList',
			reason: payload.selectedMessage
				? `target_message_id=${payload.selectedMessage.id}`
				: 'system_email_list',
		})
		return {
			forbidden: false as const,
			payload,
			head: loadDocumentHead(
				'adminSystemEmail',
				url.pathname,
				undefined,
				url.search,
			),
		}
	})

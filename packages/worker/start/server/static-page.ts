import { createServerFn } from '@tanstack/react-start'

const staticPages = new Set([
	'/support',
	'/privacy',
	'/terms',
	'/case-studies',
	'/faq',
	'/pricing',
	'/discord',
	'/login',
	'/signup',
])
export const loadStaticPage = createServerFn({ method: 'GET' })
	.validator((pathname: string) => {
		if (!staticPages.has(pathname)) throw new Error('Unknown page')
		return pathname
	})
	.handler(async ({ data: pathname }) => {
		const { loadDocumentHead } = await import('./document-head.ts')
		return { head: loadDocumentHead(pathname) }
	})

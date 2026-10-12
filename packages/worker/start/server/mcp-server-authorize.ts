import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { parseOrgResourcePath } from '#universal/org-pages.ts'
export const loadMcpServerAuthorizePage = createServerFn({ method: 'GET' })
	.validator((href: string) => {
		if (
			typeof href !== 'string' ||
			!href.startsWith('/') ||
			href.startsWith('//') ||
			href.includes('\\')
		)
			throw new Error('Invalid consent URL')
		const path = parseOrgResourcePath(
			new URL(href, 'https://kody.local').pathname,
		)
		if (
			!path ||
			path.section !== 'mcp-servers' ||
			!/^[^/]+\/authorize$/.test(path.rest)
		)
			throw new Error('Invalid consent URL')
		return href
	})
	.handler(async ({ data: href }) => {
		const [
			{ env },
			{ getRequest, setResponseHeader, setResponseStatus },
			{ getEnv },
			{ setAuthSessionSecret },
			{ loadMcpServerAuthorizeData },
			{ loadDocumentHead },
		] = await Promise.all([
			import('cloudflare:workers'),
			import('@tanstack/react-start/server'),
			import('../../src/app/env.ts'),
			import('../../src/app/auth-session.ts'),
			import('../../src/app/handlers/org-mcp-server-authorize.ts'),
			import('./document-head.ts'),
		])
		const bindings = getEnv(env)
		setAuthSessionSecret(bindings.COOKIE_SECRET)
		setResponseHeader('Cache-Control', 'no-store')
		const original = getRequest()
		const request = new Request(new URL(href, original.url), {
			headers: original.headers,
		})
		const path = parseOrgResourcePath(new URL(request.url).pathname)!
		const result = await loadMcpServerAuthorizeData({
			env: bindings,
			request,
			params: {
				orgSlug: path.slug,
				serverId: decodeURIComponent(path.rest.split('/')[0]!),
			},
		})
		if (result.kind === 'signed-out')
			throw redirect({ href: `/login?redirectTo=${encodeURIComponent(href)}` })
		if (result.kind !== 'ready') {
			setResponseStatus(result.kind === 'forbidden' ? 403 : 404)
			return {
				payload: null,
				error: result.title,
				head: loadDocumentHead(new URL(request.url).pathname, {}),
			}
		}
		return {
			payload: result.payload,
			error: null,
			head: loadDocumentHead(new URL(request.url).pathname, {
				mcpServerAuthorize: result.payload,
			}),
		}
	})

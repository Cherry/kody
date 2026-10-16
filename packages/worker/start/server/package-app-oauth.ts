import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import {
	getRequest,
	setResponseHeader,
	setResponseStatus,
} from '@tanstack/react-start/server'
import { z } from 'zod'
import { getStartRequestEnv } from './request-env.ts'
import { packageAppOauthPaths } from '#universal/package-app-oauth-paths.ts'

async function resolve(request: Request, allowConsentSkip: boolean) {
	const { handlePackageAppOauthAuthorizeRequest } =
		await import('../../src/app/package-app-oauth-authorize.ts')
	return handlePackageAppOauthAuthorizeRequest(request, getStartRequestEnv(), {
		allowConsentSkip,
	})
}

function authorizeRequest(request: Request, search: string) {
	return new Request(
		new URL(`${packageAppOauthPaths.authorize}${search}`, request.url),
		{ headers: request.headers },
	)
}

export const loadPackageAppOauthConsent = createServerFn({ method: 'GET' })
	.validator(
		z
			.string()
			.refine(
				(search) => search === '' || search.startsWith('?'),
				'Invalid authorization search',
			),
	)
	.handler(async ({ data }) => {
		setResponseHeader('Cache-Control', 'private, no-store')
		setResponseHeader('Referrer-Policy', 'no-referrer')
		const result = await resolve(authorizeRequest(getRequest(), data), false)
		if (result instanceof Response) {
			const location = result.headers.get('Location')
			if (location) throw redirect({ href: location, reloadDocument: true })
			setResponseStatus(result.status)
			throw new Error(await result.text())
		}
		return result.consent
	})

/** Only the document protocol dispatch can skip consent and issue a code. */
export async function packageAppOauthAuthorizeDocument<T>({
	request,
	next,
}: {
	request: Request
	next: () => T
}) {
	const result = await resolve(request, true)
	if (result instanceof Response) return result
	setResponseHeader('Cache-Control', 'private, no-store')
	setResponseHeader('Referrer-Policy', 'no-referrer')
	return next()
}

export async function packageAppOauthAuthorizePost({
	request,
}: {
	request: Request
}) {
	const result = await resolve(request, true)
	if (result instanceof Response) return result
	throw new Error('Authorization decisions must return a protocol response')
}

export function rejectPackageAppOauthMethod() {
	return new Response('Method not allowed.', {
		status: 405,
		headers: { Allow: 'GET, HEAD, POST', 'Cache-Control': 'no-store' },
	})
}

export const decidePackageAppOauthConsent = createServerFn({ method: 'POST' })
	.validator(
		z.strictObject({
			fields: z.record(z.string(), z.string()),
			decision: z.enum(['approve', 'deny']),
		}),
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({}, async ({ request, env }) => {
			const [{ checkAuthRateLimit }, { getRequestIp }] = await Promise.all([
				import('../../src/app/rate-limit.ts'),
				import('../../src/audit-log.ts'),
			])
			const limit = await checkAuthRateLimit(
				env,
				`auth:ip:${getRequestIp(request) ?? 'unknown'}`,
			)
			if (!limit.allowed) {
				setResponseStatus(429)
				setResponseHeader('Retry-After', String(limit.retryAfterSeconds ?? 60))
				throw new Error('Too many requests. Please try again later.')
			}
			const headers = new Headers(request.headers)
			headers.set('Content-Type', 'application/x-www-form-urlencoded')
			headers.delete('Content-Length')
			const result = await resolve(
				new Request(new URL(packageAppOauthPaths.authorize, request.url), {
					method: 'POST',
					headers,
					body: new URLSearchParams({
						...data.fields,
						decision: data.decision,
					}),
				}),
				false,
			)
			if (!(result instanceof Response))
				throw new Error(
					'Authorization decisions must return a protocol response',
				)
			const location = result.headers.get('Location')
			if (location) throw redirect({ href: location, reloadDocument: true })
			throw new Error(await result.text())
		})
	})

export async function packageAppOauthHostAuth({
	request,
}: {
	request: Request
}) {
	const env = getStartRequestEnv()
	const { getPackageAppBaseUrl } = await import('../../src/app-base-url.ts')
	if (getPackageAppBaseUrl({ env }))
		return new Response('Not found.', { status: 404 })
	const { handlePackageAppOauthHostAuth } =
		await import('../../src/app/package-app-oauth-host-auth.ts')
	return (
		(await handlePackageAppOauthHostAuth({
			env,
			request,
			url: new URL(request.url),
		})) ?? new Response('Not found.', { status: 404 })
	)
}

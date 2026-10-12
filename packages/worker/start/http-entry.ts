import * as Sentry from '@sentry/cloudflare'
import { createBackendRouter } from './backend-router.ts'
import { type OAuthPageOptions } from '#universal/oauth-page.ts'
import { setAuthSessionSecret } from '../src/app/auth-session.ts'
import { getEnv } from '../src/app/env.ts'
import { runWithRequestContext } from '../src/request-context.ts'
import { runWithDeferredWork } from '../src/deferred-work.ts'
import { wasSentryReported } from '../src/app/sentry-reported-error.ts'
import {
	renderInternalServerErrorPage,
	retryHrefFromRequest,
} from '../src/app/internal-error-page.ts'

type RenderDocument = (
	request: Request,
	env: Env,
	oauthPage?: OAuthPageOptions,
	failure?: { status: 403 | 404 | 500 },
) => Promise<Response>

/** The same HTTP boundary is used by the origin worker and its contract tests. */
export function createHttpRequestHandler(renderDocument: RenderDocument) {
	const routers = new WeakMap<Env, ReturnType<typeof createBackendRouter>>()
	return async function handleRequest(
		request: Request,
		env: Env,
		ctx?: Pick<ExecutionContext, 'waitUntil'>,
		oauthPage?: OAuthPageOptions,
	) {
		let appEnv: Env | undefined
		const inRequest = <T>(run: () => Promise<T>) =>
			runWithDeferredWork(
				ctx ? (promise) => ctx.waitUntil(promise) : undefined,
				() => runWithRequestContext(request, run),
			)
		try {
			const bindings = getEnv(env)
			appEnv = bindings
			setAuthSessionSecret(bindings.COOKIE_SECRET)
			return await inRequest(async () => {
				let router = oauthPage ? undefined : routers.get(bindings)
				if (!router) {
					router = createBackendRouter(bindings, (request, failure) =>
						renderDocument(request, bindings, oauthPage, failure),
					)
					if (!oauthPage) routers.set(bindings, router)
				}
				return router.fetch(request)
			})
		} catch (error) {
			console.error('Native app request failed:', error)
			if (!wasSentryReported(error)) {
				try {
					Sentry.captureException(error, {
						tags: {
							surface: 'app-router',
							pathname: new URL(request.url).pathname,
						},
					})
				} catch {
					/* Reporting must not prevent an error response. */
				}
			}
			if (appEnv) {
				const bindings = appEnv
				try {
					return await inRequest(() =>
						renderDocument(request, bindings, undefined, { status: 500 }),
					)
				} catch (renderError) {
					console.error('Native error document failed:', renderError)
				}
			}
			const response = renderInternalServerErrorPage(
				retryHrefFromRequest(request),
			)
			return request.method === 'HEAD'
				? new Response(null, {
						status: response.status,
						headers: response.headers,
					})
				: response
		}
	}
}

export const handleRequest = createHttpRequestHandler(async (...args) => {
	const { renderNativeDocument } = await import('./server.ts')
	return renderNativeDocument(...args)
})

import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { createMatcher } from 'remix/route-pattern/match'
import { routes } from '#universal/routes.ts'
import { type AccountPackageApprovePublishLoaderData } from '#universal/loader-data.ts'
function validate(data: { username: string; kodyId: string; commit?: string }) {
	if (
		!data ||
		typeof data.username !== 'string' ||
		!data.username ||
		typeof data.kodyId !== 'string' ||
		!data.kodyId ||
		(data.commit !== undefined && typeof data.commit !== 'string')
	)
		throw notFound()
	return data
}
async function review(data: ReturnType<typeof validate>) {
	const [
		{ env },
		{ getEnv },
		{ getRequest },
		{ setAuthSessionSecret },
		{ RequestContext },
		publish,
		{ loadDocumentHead },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('../../src/app/env.ts'),
		import('@tanstack/react-start/server'),
		import('../../src/app/auth-session.ts'),
		import('remix/router'),
		import('../../src/app/handlers/account-package-approve-publish.ts'),
		import('./document-head.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const original = getRequest(),
		api = routes.communityPackageApprovePublishApi
	const url = new URL(api.href(data), original.url)
	if (data.commit) url.searchParams.set('commit', data.commit)
	const context = new RequestContext<{ username: string; kodyId: string }>(
		new Request(url, { headers: original.headers }),
	)
	context.params = { username: data.username, kodyId: data.kodyId }
	const response = await publish
		.createAccountPackageApprovePublishApiHandler(bindings)
		.handler(context)
	if (response.status === 401) throw redirect({ href: '/login' })
	if (response.status >= 300 && response.status < 400) {
		const location = response.headers.get('Location')
		if (location) {
			const destination = new URL(location, original.url)
			const match = createMatcher(
				routes.communityPackageApprovePublishApi.pattern,
			).match(destination)
			if (match)
				throw redirect({
					href:
						routes.communityPackageApprovePublish.href(match.params) +
						destination.search,
				})
		}
		throw new Error('Invalid package review redirect.')
	}

	if (
		response.status === 404 ||
		response.status === 400 ||
		response.status === 403
	)
		throw notFound()
	if (!response.ok) throw new Error('Unable to load package review.')
	const payload =
		(await response.json()) as AccountPackageApprovePublishLoaderData
	return {
		payload,
		head: loadDocumentHead(routes.communityPackageApprovePublish.href(data), {
			accountPackageApprovePublish: payload,
		}),
	}
}
export const loadPublishReview = createServerFn({ method: 'GET' })
	.validator(validate)
	.handler(async ({ data }) => review(data))

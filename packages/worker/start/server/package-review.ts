import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { createMatcher } from 'remix/route-pattern/match'
import { routes } from '#universal/routes.ts'
import {
	type AccountPackageApprovePublishLoaderData,
	type PackageShareApproveChangesLoaderData,
} from '#universal/loader-data.ts'
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
async function review(
	data: ReturnType<typeof validate>,
	kind: 'publish' | 'changes',
) {
	const [
		{ env },
		{ getEnv },
		{ getRequest },
		{ setAuthSessionSecret },
		{ RequestContext },
		publish,
		changes,
		{ loadDocumentHead },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('../../src/app/env.ts'),
		import('@tanstack/react-start/server'),
		import('../../src/app/auth-session.ts'),
		import('remix/router'),
		import('../../src/app/handlers/account-package-approve-publish.ts'),
		import('../../src/app/handlers/package-share-approve-changes.ts'),
		import('./document-head.ts'),
	])
	const bindings = getEnv(env)
	setAuthSessionSecret(bindings.COOKIE_SECRET)
	const original = getRequest(),
		api =
			kind === 'publish'
				? routes.communityPackageApprovePublishApi
				: routes.communityPackageApproveChangesApi
	const url = new URL(api.href(data), original.url)
	if (data.commit) url.searchParams.set('commit', data.commit)
	const context = new RequestContext<{ username: string; kodyId: string }>(
		new Request(url, { headers: original.headers }),
	)
	context.params = { username: data.username, kodyId: data.kodyId }
	const response =
		kind === 'publish'
			? await publish
					.createAccountPackageApprovePublishApiHandler(bindings)
					.handler(context)
			: await changes
					.createCommunityPackageApproveChangesApiHandler(bindings)
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
		(kind === 'publish' && (response.status === 400 || response.status === 403))
	)
		throw notFound()
	if (!response.ok) throw new Error('Unable to load package review.')
	const payload = (await response.json()) as
		| AccountPackageApprovePublishLoaderData
		| PackageShareApproveChangesLoaderData
	return {
		payload,
		head: loadDocumentHead(
			(kind === 'publish'
				? routes.communityPackageApprovePublish
				: routes.communityPackageApproveChanges
			).href(data),
			kind === 'publish'
				? {
						accountPackageApprovePublish:
							payload as AccountPackageApprovePublishLoaderData,
					}
				: {
						packageShareApproveChanges:
							payload as PackageShareApproveChangesLoaderData,
					},
		),
	}
}
export const loadPublishReview = createServerFn({ method: 'GET' })
	.validator(validate)
	.handler(async ({ data }) => {
		const result = await review(data, 'publish')
		return {
			...result,
			payload: result.payload as AccountPackageApprovePublishLoaderData,
		}
	})
export const loadShareReview = createServerFn({ method: 'GET' })
	.validator(validate)
	.handler(async ({ data }) => {
		const result = await review(data, 'changes')
		return {
			...result,
			payload: result.payload as PackageShareApproveChangesLoaderData,
		}
	})

import { createServerFn } from '@tanstack/react-start'
import { notFound, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import {
	type PackageCollaboratorsLoaderData,
	packageCollaboratorPresets,
} from '#universal/package-collaborators.ts'

const packageInput = z.object({
	username: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	kodyId: z.string().min(1),
})
const change = z.discriminatedUnion('intent', [
	z.strictObject({
		intent: z.literal('grant'),
		subjectType: z.enum(['user', 'team']),
		subjectId: z.string().trim().min(1),
		preset: z.enum(packageCollaboratorPresets),
	}),
	z.strictObject({
		intent: z.literal('revoke'),
		grantId: z.string().trim().min(1),
	}),
])
export const loadPackageCollaborators = createServerFn({ method: 'GET' })
	.validator(packageInput)
	.handler(async ({ data }) => {
		const [
			{ withWebsiteRead, WebsiteAuthenticationError },
			{ loadPackagePage, packagePageIsPrivate },
			{ readPackageCollaborators },
			{ loadDocumentHead },
		] = await Promise.all([
			import('./mutation-context.ts'),
			import('../../src/app/package-page.ts'),
			import('../../src/app/handlers/package-collaborators.ts'),
			import('./document-head.ts'),
		])
		const href = `/@${encodeURIComponent(data.username)}/${encodeURIComponent(data.kodyId)}/collaborators`
		try {
			return await withWebsiteRead({}, async ({ request, env, user }) => {
				const page = await loadPackagePage({ env, request, ...data })
				if (page.kind === 'no_access') {
					const { packageNoAccessResult } =
						await import('./package-no-access.ts')
					return { ...packageNoAccessResult(page, href), payload: null }
				}
				if (page.kind === 'redirect')
					throw redirect({ href: `${page.to}/collaborators`, statusCode: 302 })
				if (
					page.kind !== 'page' ||
					!page.ownerPackage ||
					!page.viewerCanManageAccess
				)
					throw notFound()
				const result = await readPackageCollaborators({
					request,
					env,
					user,
					...data,
				})
				if (!result.data.ok) throw notFound()
				const payload: PackageCollaboratorsLoaderData = {
					ok: true,
					shell: {
						username: page.username,
						kodyId: page.kodyId,
						name: page.ownerPackage.name,
						description: page.ownerPackage.description ?? '',
						isPrivate: packagePageIsPrivate(page),
						isListed: page.ownerPackage.hasCommunityListing === true,
						listingId: page.listing?.listing?.id ?? null,
						defaultBranch: page.listing?.listing?.defaultBranch ?? null,
						publishedCommit: page.ownerPackage.publishedCommit ?? null,
						ownerProfilePublic: page.ownerProfilePublic,
						viewerCanManage: page.viewerCanManage,
					},
					view: result.data,
				}
				return {
					kind: 'page' as const,
					payload,
					head: loadDocumentHead(href, { packageCollaborators: payload }),
				}
			})
		} catch (error) {
			if (error instanceof WebsiteAuthenticationError)
				throw redirect({
					href: `/login?redirectTo=${encodeURIComponent(href)}`,
				})
			throw error
		}
	})
export const updatePackageCollaborators = createServerFn({ method: 'POST' })
	.validator(packageInput.extend({ change }))
	.handler(async ({ data }) => {
		const [{ withWebsiteMutation }, { mutatePackageCollaborators }] =
			await Promise.all([
				import('./mutation-context.ts'),
				import('../../src/app/handlers/package-collaborators.ts'),
			])
		return withWebsiteMutation({}, async ({ request, env, user }) => {
			const result = await mutatePackageCollaborators({
				request,
				env,
				user,
				username: data.username,
				kodyId: data.kodyId,
				body: data.change,
			})
			if (!result.data.ok) throw new Error(result.data.error)
			return result.data
		})
	})

import { viewerCanManageSavedPackage } from '#app/package-viewer-access.ts'
import { type Action } from 'remix/router'
import { loadAccountPackageApprovePublishData } from '#app/account-package-publish-lock.ts'
import { loadPackagePage } from '#app/package-page.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { routes } from '#universal/routes.ts'
import { loadOrgBindingForOrg } from '#worker/orgs/repo.ts'
import { getSavedPackageByIdInAnyOrg } from '#worker/package-registry/repo.ts'
import {
	readPackageId,
	readCanonicalPackageParams,
	redirectToCanonicalApproval,
} from './account-package-approve-publish.ts'

export function createAccountPackageApprovePublishHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const packageId = readPackageId(params)
			if (packageId) {
				const savedPackage = await getSavedPackageByIdInAnyOrg(
					env.APP_DB,
					packageId,
				)
				if (
					!savedPackage ||
					!(await viewerCanManageSavedPackage({
						env,
						viewer: user.mcpUser,
						ownerId: savedPackage.userId,
						packageId: savedPackage.id,
					}))
				) {
					return renderAppPage({
						request,
						env,
						title: 'Package not found',
						notFound: true,
						status: 404,
					})
				}
				const binding = await loadOrgBindingForOrg(
					env.APP_DB,
					user.mcpUser.userId,
					savedPackage.userId,
				)
				return redirectToCanonicalApproval({
					request,
					username: binding?.org.slug ?? user.username,
					kodyId: savedPackage.kodyId,
				})
			}

			const canonicalParams = readCanonicalPackageParams(params)
			if (!canonicalParams) {
				return new Response('Not found', { status: 404 })
			}
			const page = await loadPackagePage({
				env,
				request,
				username: canonicalParams.username,
				kodyId: canonicalParams.kodyId,
			})
			if (page.kind === 'redirect') {
				const destination = new URL(`${page.to}/approve-publish`, request.url)
				destination.search = new URL(request.url).search
				return new Response(null, {
					status: 302,
					headers: {
						location: destination.toString(),
						'cache-control': 'private, no-store',
					},
				})
			}
			if (page.kind !== 'page' || !page.viewerCanManage || !page.ownerPackage) {
				return renderAppPage({
					request,
					env,
					title: 'Package not found',
					notFound: true,
					status: 404,
				})
			}
			const accountPackageApprovePublish =
				await loadAccountPackageApprovePublishData({
					env,
					request,
					user,
					packageId: page.ownerPackage.id,
				})
			if (!accountPackageApprovePublish.ok) {
				return new Response(accountPackageApprovePublish.error, { status: 404 })
			}
			return renderAppPage({
				request,
				env,
				title: 'Approve package publish',
				loaderData: { accountPackageApprovePublish },
			})
		},
	} satisfies Action<
		| typeof routes.accountPackageApprovePublish
		| typeof routes.communityPackageApprovePublish
	>
}

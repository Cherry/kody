import { type Action } from 'remix/router'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { viewerCanReadSavedPackage } from '#app/package-viewer-access.ts'
import { loadOrgBindingForOrg } from '#worker/orgs/repo.ts'
import { getSavedPackageByIdInAnyOrg } from '#worker/package-registry/repo.ts'
import { routes } from '#universal/routes.ts'

export function createAccountPackagesHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const pathPackageId =
				typeof params === 'object' &&
				params !== null &&
				'packageId' in params &&
				typeof params.packageId === 'string'
					? params.packageId
					: undefined
			const url = new URL(request.url)
			if (pathPackageId) {
				const savedPackage = await getSavedPackageByIdInAnyOrg(
					env.APP_DB,
					pathPackageId,
				)
				if (
					!savedPackage ||
					!(await viewerCanReadSavedPackage({
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
				const destination = new URL(
					routes.communityPackage.href({
						username: binding?.org.slug ?? user.username,
						kodyId: savedPackage.kodyId,
					}),
					url,
				)
				destination.search = url.search
				return new Response(null, {
					status: 302,
					headers: { location: destination.toString() },
				})
			}

			const destination = new URL(
				routes.profile.href({ username: user.username }),
				url,
			)
			destination.search = url.search
			return new Response(null, {
				status: 302,
				headers: { location: destination.toString() },
			})
		},
	} satisfies Action<typeof routes.accountPackageDetail>
}

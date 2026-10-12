import { loadWritableAccountSavedPackage } from '#app/account-package-write-access.ts'
import { jsonResponse } from '#worker/json-response.ts'
import { type Action } from 'remix/router'
import { handleAccountPackageAdoptAction } from '#app/account-package-adopt.ts'
import { handleAccountPackageDeleteAction } from '#app/account-package-delete.ts'
import { handleAccountPackagePublishLockAction } from '#app/account-package-publish-lock.ts'
import { handleAccountPackageVisibilityAction } from '#app/account-package-visibility.ts'
import {
	loadAccountPackagesData,
	reloadAccountPackagesAfterWrite,
} from '#app/account-packages-data.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import { CommunityActionError } from '#worker/community/errors.ts'
import { absorbCommunityForkUpstream } from '#worker/community/service.ts'
import { routes } from '#universal/routes.ts'

export function createAccountPackagesApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			const user = await readAuthenticatedAppUser(request, env)
			if (!user) {
				return jsonResponse({ ok: false, error: 'Unauthorized.' }, 401)
			}

			if (request.method === 'GET') {
				return jsonResponse(
					await loadAccountPackagesData({ env, request, user }),
				)
			}

			if (request.method !== 'POST') {
				return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)
			}

			const body = await request.json().catch(() => null)
			if (!body || typeof body !== 'object' || Array.isArray(body)) {
				return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400)
			}

			const publishLockResponse = await handleAccountPackagePublishLockAction({
				env,
				request,
				user,
				body,
			})
			if (publishLockResponse) return publishLockResponse

			const visibilityResponse = await handleAccountPackageVisibilityAction({
				env,
				request,
				user,
				body,
			})
			if (visibilityResponse) return visibilityResponse

			const deleteResponse = await handleAccountPackageDeleteAction({
				env,
				user,
				body,
			})
			if (deleteResponse) return deleteResponse

			const adoptResponse = await handleAccountPackageAdoptAction({
				env,
				request,
				user,
				body,
			})
			if (adoptResponse) return adoptResponse

			const action = readTrimmedStringOrEmpty(body, 'action')
			if (action === 'absorb-listing') {
				const packageId = readTrimmedStringOrEmpty(body, 'packageId')
				if (!packageId) {
					return jsonResponse(
						{ ok: false, error: 'Package id is required.' },
						400,
					)
				}
				const resolved = await loadWritableAccountSavedPackage({
					env,
					user,
					packageId,
					permission: 'package:write',
				})
				if (!resolved.ok) return resolved.response
				try {
					await absorbCommunityForkUpstream({
						env,
						userId: resolved.package.ownerUserId,
						packageId,
					})
				} catch (error) {
					if (error instanceof CommunityActionError) {
						return jsonResponse({ ok: false, error: error.message }, 400)
					}
					throw error
				}
				return jsonResponse(
					await reloadAccountPackagesAfterWrite({
						env,
						request,
						user,
						packageId,
						ownerUserId: resolved.package.ownerUserId,
					}),
				)
			}

			return jsonResponse({ ok: false, error: 'Invalid action.' }, 400)
		},
	} satisfies Action<
		typeof routes.accountPackagesApi | typeof routes.accountPackagesApiPost
	>
}

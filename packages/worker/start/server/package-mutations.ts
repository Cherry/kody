import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const mutatePackage = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			packageId: z.string().min(1),
			body: z.record(z.string(), z.unknown()),
		}),
	)
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		return withWebsiteMutation({}, async ({ request, env, user }) => {
			const [lock, visibility, capability, deletion, adoption] =
				await Promise.all([
					import('../../src/app/account-package-publish-lock.ts'),
					import('../../src/app/account-package-visibility.ts'),
					import('../../src/app/account-package-capability-approval.ts'),
					import('../../src/app/account-package-delete.ts'),
					import('../../src/app/account-package-adopt.ts'),
				])
			const input = {
				env,
				request,
				user,
				body: { ...data.body, packageId: data.packageId },
			}
			for (const operation of [
				lock.mutateAccountPackagePublishLock,
				visibility.mutateAccountPackageVisibility,
				capability.mutateAccountPackageInternetVisible,
				deletion.mutateAccountPackageDelete,
				adoption.mutateAccountPackageAdopt,
			]) {
				const result = await operation(input)
				if (result) return result.data
			}
			if (data.body.action === 'absorb-listing') {
				const { loadWritableAccountSavedPackage } =
					await import('../../src/app/account-package-write-access.ts')
				const resolved = await loadWritableAccountSavedPackage({
					env,
					user,
					packageId: data.packageId,
					permission: 'package:write',
				})
				if (!resolved.ok) return { ok: false, error: 'Package not found.' }
				const { absorbCommunityForkUpstream } =
					await import('../../src/community/service.ts')
				const { CommunityActionError } =
					await import('../../src/community/errors.ts')
				try {
					await absorbCommunityForkUpstream({
						env,
						userId: resolved.package.ownerUserId,
						packageId: data.packageId,
					})
				} catch (error) {
					if (error instanceof CommunityActionError)
						return { ok: false, error: error.message }
					throw error
				}
				const { reloadAccountPackagesAfterWrite } =
					await import('../../src/app/account-packages-data.ts')
				return reloadAccountPackagesAfterWrite({
					...input,
					packageId: data.packageId,
					ownerUserId: resolved.package.ownerUserId,
				})
			}
			return { ok: false, error: 'Invalid action.' }
		})
	})

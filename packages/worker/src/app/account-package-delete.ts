import { loadWritableAccountSavedPackage } from '#app/account-package-write-access.ts'
import {
	packageMutationResult,
	type PackageMutationResult,
} from './package-mutation-result.ts'
import { CommunityActionError } from '#worker/community/errors.ts'
import {
	deleteSavedPackageProjection,
	PackageStorageCleanupError,
} from '#worker/package-registry/service.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'

type AuthenticatedUser = NonNullable<
	Awaited<ReturnType<typeof readAuthenticatedAppUser>>
>

export async function mutateAccountPackageDelete(input: {
	env: Env
	user: AuthenticatedUser
	body: object
}): Promise<PackageMutationResult | null> {
	const action = readTrimmedStringOrEmpty(input.body, 'action')
	if (action !== 'delete') return null

	const packageId = readTrimmedStringOrEmpty(input.body, 'packageId')
	const confirmName = readTrimmedStringOrEmpty(input.body, 'confirmName')
	if (!packageId) {
		return packageMutationResult(
			{ ok: false, error: 'Package id is required.' },
			400,
		)
	}

	const resolved = await loadWritableAccountSavedPackage({
		env: input.env,
		user: input.user,
		packageId,
		permission: 'package:delete',
	})
	if (!resolved.ok)
		return packageMutationResult(
			{ ok: false, error: 'Package not found.' },
			404,
		)
	const { savedPackage, ownerUserId, actorUserId } = resolved.package
	if (confirmName !== savedPackage.name) {
		return packageMutationResult(
			{
				ok: false,
				error: `Type the package name "${savedPackage.name}" to delete it.`,
			},
			400,
		)
	}

	try {
		await deleteSavedPackageProjection({
			env: input.env,
			userId: ownerUserId,
			actorUserId,
			packageId,
		})
	} catch (error) {
		if (error instanceof CommunityActionError) {
			return packageMutationResult({ ok: false, error: error.message }, 400)
		}
		if (error instanceof PackageStorageCleanupError) {
			return packageMutationResult({ ok: false, error: error.message }, 409)
		}
		throw error
	}

	return packageMutationResult({
		ok: true,
		deleted: true,
		packageId,
	})
}

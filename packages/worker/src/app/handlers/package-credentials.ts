import { operationResult } from '../operation-result.ts'
import { loadPackageMappingScopeForViewer } from '#app/package-credentials-access.ts'
import { credentialMappingChangesSchema } from '#universal/credential-mutations.ts'
import {
	MappingWriteRefused,
	resolveMappingChanges,
	writeMappingChanges,
} from '#worker/credentials/package-credential-mapping-changes.ts'
import {
	buildPackageCredentialsView,
	loadPackageMappingScope,
} from '#worker/credentials/package-credential-mappings.ts'
import { isMcpCallerError } from '#mcp/caller-error.ts'
import {
	type CredentialMappingChange,
	type PackageCredentialsWriteFailure,
} from '#universal/credential-contracts.ts'

/**
 * Applies package credential mapping changes atomically and returns the
 * updated view. Signed-in sessions only; anyone without
 * `package:execute` on the package gets a 404.
 */
export async function mutatePackageCredentialMappings({
	scope,
	body,
}: {
	scope: NonNullable<
		Awaited<ReturnType<typeof loadPackageMappingScopeForViewer>>
	>
	body: unknown
}) {
	const env = scope.env
	const parsed = credentialMappingChangesSchema.safeParse(body)
	if (!parsed.success) {
		return operationResult(
			{
				ok: false,
				error: `Invalid request body: ${parsed.error.issues[0]?.message ?? 'expected { changes }'}.`,
			},
			400,
		)
	}
	const changes: Array<CredentialMappingChange> = parsed.data.changes
	const resolved = await resolveMappingChanges(scope, changes)
	const errors = resolved.flatMap((change) =>
		change.error
			? [
					{
						needKey: change.needKey,
						target: change.target,
						...change.error,
					},
				]
			: [],
	)
	if (errors.length > 0) {
		return operationResult(
			{ ok: false, errors } satisfies PackageCredentialsWriteFailure,
			400,
		)
	}
	try {
		await writeMappingChanges(scope, resolved)
	} catch (error) {
		if (
			error instanceof MappingWriteRefused &&
			error.code !== 'webhook_other_enabler' &&
			error.code !== 'email_sender_conflict' &&
			error.change
		) {
			return operationResult(
				{
					ok: false,
					errors: [
						{
							needKey: error.change.needKey,
							target: error.change.target,
							code: error.code,
							message: error.message,
						},
					],
				} satisfies PackageCredentialsWriteFailure,
				400,
			)
		}
		// A webhook or email sender someone else turned on between resolve and write.
		if (
			!(error instanceof MappingWriteRefused) &&
			!(isMcpCallerError(error) && error instanceof Error)
		) {
			throw error
		}
		return operationResult({ ok: false, error: error.message }, 409)
	}
	const fresh = await loadPackageMappingScope({
		env,
		baseUrl: scope.baseUrl,
		request: scope.request,
		savedPackage: scope.savedPackage,
		canManage: scope.canManage,
	})
	return operationResult(await buildPackageCredentialsView(fresh))
}

import { type OwnerId } from '@kody-internal/shared/owner-person-ids.ts'
import { personalOrgIdForPerson } from '#worker/orgs/personal-org-id.ts'
import { z } from 'zod'
import { waitUntil } from 'cloudflare:workers'
import { getAppBaseUrl } from '#worker/app-base-url.ts'
import { type AuthenticatedAppUser } from '#app/authenticated-user.ts'
import {
	buildInstallAdaptPrompt,
	buildInstallSuccessPrompt,
} from '#app/community-public.ts'
import { readLastUsedOrgSlug } from '#universal/org-last-used-cookie.ts'
import {
	checkPermission,
	computeEffectivePermissions,
} from '#worker/authorization/authorize.ts'
import { CommunityActionError } from '#worker/community/errors.ts'
import {
	CommunityForkResourceLimitError,
	communityForkResourceLimitLogFields,
	isCommunityForkResourceLimitCause,
} from '#worker/community/fork-resource-limit.ts'
import { installCommunityListing } from '#worker/community/install.ts'
import { getCommunityListingById } from '#worker/community/repo.ts'
import { EntitlementLimitError } from '#worker/entitlements/errors.ts'
import { toApiError } from '#worker/open-api/errors.ts'
import { loadOrgBindingForSlug } from '#worker/orgs/repo.ts'
import { entitlementEmailForOwner } from '#worker/request-context/owner-id.ts'
import { deriveRequestContext } from '#worker/request-context/request-context.ts'
import { getPackageScopeByUserId } from '#worker/package-registry/user-scope.ts'
import { resolveArtifactSourceHead } from '#worker/repo/artifacts.ts'
import { getEntitySourceById } from '#worker/repo/entity-sources.ts'

/**
 * Community pages are not org-bound, so install into the last-used org when
 * the person still belongs there and holds `package:create`; otherwise their
 * personal org (where they are Owner).
 */
async function resolveCommunityInstallOwnerId(input: {
	env: Env
	user: AuthenticatedAppUser
	request: Request
}): Promise<OwnerId> {
	const personalId = personalOrgIdForPerson(input.user.mcpUser)
	const remembered = readLastUsedOrgSlug(input.request.headers.get('cookie'))
	if (!remembered) return personalId
	const binding = await loadOrgBindingForSlug(
		input.env.APP_DB,
		input.user.mcpUser.userId,
		remembered,
	)
	if (!binding || binding.org.id === personalId) return personalId
	const access = await computeEffectivePermissions({
		env: input.env,
		request: deriveRequestContext({
			user: input.user.mcpUser,
			source: { kind: 'session' },
			orgBinding: binding,
		}),
	})
	if (!checkPermission(access, 'package:create').allowed) return personalId
	return binding.org.id
}

const communityInstallPostSchema = z.object({
	acknowledged: z.boolean().optional(),
	kody_id: z.string().trim().min(1).optional(),
})

const thirdPartyInstallConfirmError =
	'This listing is from another account. Confirm to install it.'

function installResult<T>(data: T, status = 200) {
	return { data, status }
}
export async function installWebsiteCommunityPackage(input: {
	env: Env
	request: Request
	user: AuthenticatedAppUser
	listingId: string
	body: unknown
}) {
	const { env, request, user, listingId } = input
	const parsed = communityInstallPostSchema.safeParse(input.body)
	if (!parsed.success)
		return installResult({ ok: false, error: 'Invalid request body.' }, 400)
	const listing = await getCommunityListingById(env.APP_DB, {
		listingId: listingId,
		includeDelisted: false,
	})
	if (!listing) {
		return installResult({ ok: false, error: 'Catalog entry not found.' }, 404)
	}
	// Every listing requires acknowledged: true. The listing page sends
	// that flag after createDoubleCheck confirms the fork.
	if (parsed.data.acknowledged !== true) {
		return installResult(
			{
				ok: false,
				requiresAcknowledgement: true,
				error: thirdPartyInstallConfirmError,
			},
			409,
		)
	}

	try {
		const installOwnerId = await resolveCommunityInstallOwnerId({
			env,
			user,
			request,
		})
		const expectedPackageScope = await getPackageScopeByUserId(
			env.APP_DB,
			installOwnerId,
		)
		let expectedPinnedCommit = listing.pinnedCommit
		if (listing.sourceId) {
			const source = await getEntitySourceById(env.APP_DB, listing.sourceId)
			if (source?.repo_id) {
				try {
					const head = await resolveArtifactSourceHead(env, source.repo_id)
					if (head.commit) expectedPinnedCommit = head.commit
				} catch {
					// Fall back to the listing pin when HEAD cannot be read.
				}
			}
		}
		const result = await installCommunityListing({
			env,
			baseUrl: getAppBaseUrl({ env, requestUrl: request.url }),
			userId: installOwnerId,
			userEmail: entitlementEmailForOwner(
				{ user: { userId: user.mcpUser.userId, email: user.email } },
				installOwnerId,
			),
			expectedPackageScope,
			listingId: listing.id,
			kodyId: parsed.data.kody_id,
			// Bind the install to origin HEAD (the commit the fork copies)
			// so a concurrent push cannot activate content the user never saw.
			expectedPinnedCommit,
			// Projection already supports deferred search-index upsert and
			// retriever-cache refresh; without waitUntil those await on the
			// install response and stretch one-click / onboarding latency.
			waitUntil,
		})
		if (result.status === 'adaptation_required') {
			return installResult({
				ok: true,
				status: result.status,
				packageId: result.packageId,
				sourceId: result.sourceId,
				targetName: result.targetName,
				failedChecks: result.failedChecks.map((check) => ({
					kind: check.kind,
					message: check.message,
				})),
				agentPrompt: buildInstallAdaptPrompt({
					targetName: result.targetName,
					sourceId: result.sourceId,
				}),
			})
		}
		return installResult({
			ok: true,
			status: result.status,
			packageId: result.packageId,
			sourceId: result.sourceId,
			targetName: result.targetName,
			agentPrompt: buildInstallSuccessPrompt({
				targetName: result.targetName,
			}),
		})
	} catch (error) {
		if (
			error instanceof CommunityActionError ||
			error instanceof EntitlementLimitError
		) {
			return installResult({ ok: false, error: error.message }, 400)
		}
		if (
			error instanceof CommunityForkResourceLimitError ||
			isCommunityForkResourceLimitCause(error)
		) {
			const mapped =
				error instanceof CommunityForkResourceLimitError
					? error
					: new CommunityForkResourceLimitError(error)
			console.error(
				'Community install failed:',
				communityForkResourceLimitLogFields(error),
			)
			return installResult({ ok: false, error: mapped.message }, 503)
		}
		// Same Open API remap as communityFork: Artifacts git transients
		// become 503 with a retry next step; other unknowns keep the
		// generic internal message that says retry or report.
		const apiError = toApiError(error)
		console.error('Community install failed:', error)
		return installResult(
			{ ok: false, error: apiError.message },
			apiError.status,
		)
	}
}

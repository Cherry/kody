import { type HighlightedCode } from '#universal/highlighted-code.ts'
import {
	type PublicCommunityListing,
	type ViewerListingInstall,
} from '#universal/community-public-types.ts'
import { type AccountPackageDetail } from '#universal/loader-data.ts'
import { type PackageShareGrantLoaderView } from '#universal/package-share.ts'
export type CommunityDetailApiPayload = {
	ok: true
	listing: PublicCommunityListing | null
	ownerProfilePublic: boolean
	loggedIn: boolean
	viewerIsAdmin: boolean
	viewerIsOwner: boolean
	forkPrompt: string
	viewerInstall: ViewerListingInstall | null
	readmeContent: string | null
	readmeFences?: Array<HighlightedCode>
	hasAgentsDocs?: boolean
	imageBaseHref?: string | null
	ownerPackage: AccountPackageDetail | null
	username: string
	kodyId: string
	isPrivate: boolean
	invocationUrlOrigin: string
	shareGrant?: PackageShareGrantLoaderView | null
}

export type CommunityInstallApiPayload = {
	ok: boolean
	requiresAcknowledgement?: boolean
	status?: 'installed' | 'adaptation_required'
	packageId?: string
	targetName?: string
	agentPrompt?: string
	failedChecks?: Array<{ kind: string; message: string }>
	error?: string
}

export type CommunityInstallOutcome = {
	status: 'installed' | 'adaptation_required'
	targetName: string
	agentPrompt: string
	packageId: string | null
	failedChecks: Array<{ kind: string; message: string }>
}

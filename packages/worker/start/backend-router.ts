import { createRouter } from 'remix/router'
import {
	createAdminHandler,
	createAdminUsersApiHandler,
	createAdminUserUsageApiHandler,
} from '#app/handlers/admin-users.ts'
import { createAdminCommunityReportsApiHandler } from '#app/handlers/admin-community-reports.ts'
import { createAdminReservedUsernamesApiHandler } from '#app/handlers/admin-reserved-usernames.ts'
import { createAdminFeatureFlagsApiHandler } from '#app/handlers/admin-feature-flags.ts'
import { createYoutubeThumbHandler } from '#app/handlers/youtube-thumb.ts'
import { createLandingHeroVideosApiHandler } from '#app/handlers/landing-hero-videos.ts'
import { createAdminPlatformIntegrationsApiHandler } from '#app/handlers/admin-platform-integrations.ts'
import { createAdminProviderMarksApiHandler } from '#app/handlers/admin-provider-marks.ts'
import {
	createAdminCodemodsApiHandler,
	createAdminCodemodsRunApiHandler,
	createAdminCodemodsRunStopApiHandler,
} from '#app/handlers/admin-codemods.ts'
import { createAdminRolesApiHandler } from '#app/handlers/admin-roles.ts'
import { createAdminInsightsApiHandler } from '#app/handlers/admin-insights.ts'
import { createAdminPlatformFeedbackApiHandler } from '#app/handlers/admin-platform-feedback.ts'
import { createAdminSystemEmailApiHandler } from '#app/handlers/admin-system-email.ts'
import { createAccountDeleteHandler } from '#app/handlers/account-delete.ts'
import { createAccountEmailApiHandler } from '#app/handlers/account-email.ts'
import { createAccountEmailChangeHandler } from '#app/handlers/account-email-change.ts'
import { createAccountEmailClaimReleaseHandler } from '#app/handlers/account-email-claim-release.ts'
import { createAccountPasswordHandler } from '#app/handlers/account-password.ts'
import { createAccountExportHandler } from '#app/handlers/account-export.ts'
import { createAccountIntegrationsApiHandler } from '#app/handlers/account-integrations.ts'
import { createAccountActivityApiHandler } from '#app/handlers/account-activity.ts'
import { createAccountJobsApiHandler } from '#app/handlers/account-jobs.ts'
import { createAccountWorkflowsApiHandler } from '#app/handlers/account-workflows.ts'
import { createAccountWebhooksApiHandler } from '#app/handlers/account-webhooks.ts'
import {
	createAccountMcpServersApiHandler,
	createAccountMcpServersOauthCallbackHandler,
} from '#app/handlers/account-mcp-servers.ts'
import { createOrgMcpServerAuthorizePostHandler } from '#app/handlers/org-mcp-server-authorize.ts'
import {
	createAccountMemoriesApiHandler,
	createAccountMemoriesExportHandler,
} from '#app/handlers/account-memories.ts'
import { createAccountPackageApproveCapabilitiesApiHandler } from '#app/handlers/account-package-approve-capabilities.ts'
import { createAccountPackageApprovePublishApiHandler } from '#app/handlers/account-package-approve-publish.ts'
import { createAccountPackagesApiHandler } from '#app/handlers/account-packages.ts'
import {
	createAccountPackageFilesApiHandler,
	createCommunityDetailFilesApiHandler,
	createCommunityPackageFilesApiHandler,
} from '#app/handlers/package-files.ts'
import {
	createCommunityDetailRawHandler,
	createCommunityPackageRawHandler,
} from '#app/handlers/package-files-raw.ts'
import { createAccountPasskeysApiHandler } from '#app/handlers/account-passkeys.ts'
import { createAccountMcpOauthClientsApiHandler } from '#app/handlers/account-mcp-oauth-clients.ts'
import { createAccountConnectionsApiHandler } from '#app/handlers/account-connections.ts'
import { createAccountConnectedAgentsApiHandler } from '#app/handlers/account-connected-agents.ts'
import { createAccountConnectionUsageApiHandler } from '#app/handlers/account-connection-usage.ts'
import { createAccountAvatarApiPostHandler } from '#app/handlers/account-avatar.ts'
import { createAccountProfileApiHandler } from '#app/handlers/account-profile.ts'
import { createAccountTwoFactorApiHandler } from '#app/handlers/account-two-factor.ts'
import {
	createAccountBillingCancellationFeedbackApiHandler,
	createOrgBillingApiHandler,
	createOrgBillingCheckoutApiHandler,
	createOrgBillingPortalHandler,
} from '#app/handlers/org-billing.ts'
import { createAdminUserCreditsApiHandler } from '#app/handlers/admin-user-credits.ts'
import { createAdminOrgLimitsApiHandler } from '#app/handlers/admin-org-limits.ts'
import {
	createAccountCreditsHandler,
	createAccountCreditsSettingsApiHandler,
	createAccountCreditsTopUpApiHandler,
} from '#app/handlers/account-credits.ts'
import { createAccountUsageApiHandler } from '#app/handlers/account-usage.ts'
import {
	createAccountWaitingApiHandler,
	createAccountWaitingClickHandler,
} from '#app/handlers/account-waiting.ts'
import { createAccountExperimentsApiHandler } from '#app/handlers/account-experiments.ts'
import { createCommunityPackageWebhooksApiHandler } from '#app/handlers/package-webhooks.ts'
import { createAccountResendVerificationHandler } from '#app/handlers/account-resend-verification.ts'
import { createAccountSecretsApiHandler } from '#app/handlers/account-secrets.ts'
import { createAccountSecretProvidersApiHandler } from '#app/handlers/account-secret-providers.ts'
import { createAccountValuesApiHandler } from '#app/handlers/account-values.ts'
import { createAuthHandler } from '#app/handlers/auth.ts'
import {
	createAuthProviderCallbackHandler,
	createAuthProviderStartHandler,
	createAuthProvidersApiHandler,
} from '#app/handlers/auth-provider.ts'
import { createAccountWebhooksApproveApplyApiHandler } from '#app/handlers/account-webhooks-approve-apply.ts'
import { createCommunityApiHandler } from '#app/handlers/community.tsx'
import {
	createCommunityDetailApiHandler,
	createCommunityDetailOgImageHandler,
	createCommunityPackageApiHandler,
	createCommunityReportApiPostHandler,
} from '#app/handlers/community-detail.tsx'
import { createCommunityFeatureApiPostHandler } from '#app/handlers/community-feature.ts'
import { createAccountRepoIconHandler } from '#app/handlers/account-repo-icon.ts'
import { createCommunityIconHandler } from '#app/handlers/community-icon.ts'
import { createCommunityPackageIconHandler } from '#app/handlers/community-package-icon.ts'
import {
	createCommunityDetailAssetHandler,
	createCommunityPackageAssetHandler,
} from '#app/handlers/package-readme-assets.ts'
import { createIntegrationLogoHandler } from '#app/handlers/integration-logo.ts'
import { createProviderMarkLogoHandler } from '#app/handlers/provider-mark-logo.ts'
import { createMcpServerLogoHandler } from '#app/handlers/mcp-server-logo.ts'
import { createCommunityInstallApiPostHandler } from '#app/handlers/community-install.ts'
import { createCommunityTrustApiPostHandler } from '#app/handlers/community-trust.ts'
import {
	createProfileApiHandler,
	createProfileOgImageHandler,
} from '#app/handlers/profile.tsx'
import { createProfileAvatarHandler } from '#app/handlers/profile-avatar.ts'
import { createWebhookIngressHandler } from '#app/handlers/webhook-ingress.ts'
import { createStripeWebhookHandler } from '#app/handlers/stripe-webhook.ts'
import {
	createBlogApiHandler,
	createBlogPostApiHandler,
	createBlogPostMarkdownHandler,
	createBlogPostOgImageHandler,
	createBlogRssHandler,
} from '#app/handlers/blog.tsx'
import {
	createDocDetailApiHandler,
	createDocDetailMarkdownHandler,
	createDocDetailOgImageHandler,
	createDocsApiHandler,
	createDocsConnectApiHandler,
	createDocsConnectMarkdownHandler,
	createDocsLlmsTxtHandler,
	createDocsMarkdownHandler,
	createLlmsTxtHandler,
} from '#app/handlers/docs.tsx'
import { createPackageSkillsOptInHandler } from '#app/handlers/package-skills-opt-in.ts'
import { createMcpEventsOptInHandler } from '#app/handlers/mcp-events-opt-in.ts'
import {
	createLegacyGuidesApiRedirectHandler,
	createLegacyGuidesMarkdownRedirectHandler,
	createLegacyGuidesPathRedirectHandler,
	createLegacyGuidesRedirectHandler,
} from '#app/handlers/legacy-guides-redirect.ts'
import { createHealthHandler } from '#app/handlers/health.ts'
import { createHealthComponentsHandler } from '#app/handlers/health-components.ts'
import { createSentryTunnelHandler } from '#app/handlers/sentry-tunnel.ts'
import {
	createAgentSkillMarkdownHandler,
	createAgentSkillsIndexHandler,
	createApiCatalogHandler,
	createAuthMarkdownHandler,
	createMcpServerCardHandler,
	createOpenaiAppsChallengeHandler,
	createRobotsTxtHandler,
	createSecurityTxtHandler,
	createSitemapHandler,
} from '#app/handlers/agent-discovery.ts'
import { createOgPageImageHandler } from '#app/handlers/og-page-image.ts'
import {
	createOnboardingApiHandler,
	createOnboardingChecklistDismissHandler,
} from '#app/handlers/onboarding.ts'
import { createDiscordApiHandler } from '#app/handlers/discord.ts'
import { createTwoFactorVerifyApiHandler } from '#app/handlers/verify.ts'
import { createAccountEmailDestinationsHandler } from '#app/handlers/account-email-destinations.ts'
import {
	createWebauthnAuthenticationHandler,
	createWebauthnRegistrationHandler,
} from '#app/handlers/webauthn.ts'
import { logout } from '#app/handlers/logout.ts'
import {
	createPasswordResetConfirmHandler,
	createPasswordResetRequestHandler,
} from '#app/handlers/password-reset.ts'
import { createSessionHandler } from '#app/handlers/session.ts'
import { routes } from '#universal/routes.ts'
import { createAccountWriteLeaseMiddleware } from '#app/account-write-lease-middleware.ts'
import { createOrgBindingGuardMiddleware } from '#app/org-binding-guard-middleware.ts'
import { remixCrossOriginProtection } from '#app/cross-origin-protection.ts'
import { createReferralCookieMiddleware } from '#app/referral-cookie-middleware.ts'
import {
	createAccountOrganizationsApiHandler,
	createAccountOrganizationsNewPostHandler,
} from '#app/handlers/account-organizations.ts'
import { createLegacyOrgPackagesApiRedirectHandler } from '#app/handlers/legacy-org-packages-redirect.ts'
import { createOrgRepositoriesApiHandler } from '#app/handlers/org-section.ts'
import { createOrgAvatarHandler } from '#app/handlers/org-avatar.ts'
import { createOrgInviteJoinPostHandler } from '#app/handlers/org-invite-join.ts'
import {
	createOrgMembersApiHandler,
	createOrgMembersInviteLinksPostHandler,
	createOrgMembersInviteLinksRevokePostHandler,
	createOrgMembersInvitePostHandler,
	createOrgMembersRemovePostHandler,
	createOrgMembersRolePostHandler,
} from '#app/handlers/org-members.ts'
import {
	createOrgTeamsApiHandler,
	createOrgTeamsCreatePostHandler,
	createOrgTeamsMemberAddPostHandler,
	createOrgTeamsMemberRemovePostHandler,
} from '#app/handlers/org-teams.ts'
import {
	createOrgGrantsApiHandler,
	createOrgGrantsRevokePostHandler,
} from '#app/handlers/org-grants.ts'
import { createOrgCollaboratorsApiHandler } from '#app/handlers/org-collaborators.ts'
import {
	createOrgSettingsApiHandler,
	createOrgSettingsAvatarPostHandler,
	createOrgSettingsDeletePostHandler,
	createOrgSettingsPostHandler,
} from '#app/handlers/org-settings.ts'
import { acquisitionPages } from '#universal/acquisition/catalog.ts'
import { renderAcquisitionMarkdown } from '#app/acquisition-markdown.ts'
import { prefersMarkdown, markdownResponse } from '#app/markdown-negotiation.ts'
import { getAppBaseUrl } from '#worker/app-base-url.ts'
import {
	buildHomeMarkdown,
	withAgentDiscoveryLinkHeaders,
} from '#app/agent-discovery.ts'
export function createBackendRouter(
	env: Env,
	renderDocument: (
		request: Request,
		failure?: { status: 403 | 404 },
	) => Promise<Response>,
) {
	const markdownRouter = createRouter({
		defaultHandler: ({ request }) => renderDocument(request),
	})
	markdownRouter.map(
		{
			home: routes.home,
			docs: routes.docs,
			docsConnect: routes.docsConnect,
			docDetail: routes.docDetail,
			blogPost: routes.blogPost,
		},
		{
			actions: {
				home: {
					middleware: [],
					handler: ({ request }) => {
						const origin = getAppBaseUrl({ env, requestUrl: request.url })
						return withAgentDiscoveryLinkHeaders(
							markdownResponse(buildHomeMarkdown(origin)),
							origin,
						)
					},
				},
				docs: createDocsMarkdownHandler(env),
				docsConnect: createDocsConnectMarkdownHandler(env),
				docDetail: createDocDetailMarkdownHandler(env),
				blogPost: createBlogPostMarkdownHandler(env),
			},
		},
	)
	for (const path of [
		'/use-cases',
		...acquisitionPages.map((page) => page.path),
	]) {
		markdownRouter.get(path, {
			middleware: [],
			handler: ({ request }) => renderAcquisitionMarkdown(request),
		})
	}
	const router = createRouter({
		middleware: [
			remixCrossOriginProtection,
			createReferralCookieMiddleware(),
			createOrgBindingGuardMiddleware(env, (request) =>
				renderDocument(request, { status: 404 }),
			),
			createAccountWriteLeaseMiddleware(env),
		],
		async defaultHandler({ request }) {
			return prefersMarkdown(request)
				? markdownRouter.fetch(request)
				: renderDocument(request)
		},
	})
	// These document URLs also have backend POST handlers. Register their GET
	// explicitly because the HTTP router returns 405 instead of its fallback
	// when a pathname exists for another method.
	for (const route of [
		routes.accountOrganizationsNew,
		routes.orgInviteJoin,
		routes.orgMcpServerAuthorize,
	]) {
		router.get(route, {
			middleware: [],
			handler: ({ request }) => renderDocument(request),
		})
	}

	router.map(
		{
			landingHeroVideosApi: routes.landingHeroVideosApi,
			robotsTxt: routes.robotsTxt,
			sitemap: routes.sitemap,
			authMarkdown: routes.authMarkdown,
			mcpServerCard: routes.mcpServerCard,
			apiCatalog: routes.apiCatalog,
			agentSkillsIndex: routes.agentSkillsIndex,
			agentSkillMarkdown: routes.agentSkillMarkdown,
			securityTxt: routes.securityTxt,
			openaiAppsChallenge: routes.openaiAppsChallenge,
			health: routes.health,
			healthComponents: routes.healthComponents,
			sentryTunnel: routes.sentryTunnel,
			ogPageImage: routes.ogPageImage,
			blogApi: routes.blogApi,
			blogRss: routes.blogRss,
			blogPostApi: routes.blogPostApi,
			blogPostMarkdown: routes.blogPostMarkdown,
			blogPostOgImage: routes.blogPostOgImage,
			docsApi: routes.docsApi,
			docsMarkdown: routes.docsMarkdown,
			docsLlmsTxt: routes.docsLlmsTxt,
			docsConnectApi: routes.docsConnectApi,
			docsConnectMarkdown: routes.docsConnectMarkdown,
			docDetailApi: routes.docDetailApi,
			docDetailMarkdown: routes.docDetailMarkdown,
			docDetailOgImage: routes.docDetailOgImage,
			packageSkillsOptInPost: routes.packageSkillsOptInPost,
			mcpEventsOptInPost: routes.mcpEventsOptInPost,
			llmsTxt: routes.llmsTxt,
			legacyGuides: routes.legacyGuides,
			legacyGuidesApi: routes.legacyGuidesApi,
			legacyGuidesMarkdown: routes.legacyGuidesMarkdown,
			legacyGuidesPath: routes.legacyGuidesPath,
			discordApi: routes.discordApi,
			onboardingApi: routes.onboardingApi,
			onboardingChecklistDismissPost: routes.onboardingChecklistDismissPost,
			youtubeThumb: routes.youtubeThumb,
			accountOrganizationsApi: routes.accountOrganizationsApi,
			accountOrganizationsNewPost: routes.accountOrganizationsNewPost,
			accountDelete: routes.accountDelete,
			accountExport: routes.accountExport,
			accountIntegrationsApi: routes.accountIntegrationsApi,
			accountIntegrationsApiPost: routes.accountIntegrationsApiPost,
			accountMcpServerLogo: routes.accountMcpServerLogo,
			accountMcpServersOauthCallback: routes.accountMcpServersOauthCallback,
			accountMcpServersApi: routes.accountMcpServersApi,
			accountMcpServersApiPost: routes.accountMcpServersApiPost,
			accountPackageApproveCapabilitiesApi:
				routes.accountPackageApproveCapabilitiesApi,
			communityPackageApproveCapabilitiesApi:
				routes.communityPackageApproveCapabilitiesApi,
			accountPackageApprovePublishApi: routes.accountPackageApprovePublishApi,
			communityPackageApprovePublishApi:
				routes.communityPackageApprovePublishApi,
			communityPackageWebhooksApi: routes.communityPackageWebhooksApi,
			communityPackageWebhooksApiPost: routes.communityPackageWebhooksApiPost,
			accountPackageFilesApi: routes.accountPackageFilesApi,
			accountPackagesApi: routes.accountPackagesApi,
			accountPackagesApiPost: routes.accountPackagesApiPost,
			accountConnectionsApi: routes.accountConnectionsApi,
			accountConnectionsApiPost: routes.accountConnectionsApiPost,
			accountConnectedAgentsApi: routes.accountConnectedAgentsApi,
			accountConnectedAgentsApiPost: routes.accountConnectedAgentsApiPost,
			accountConnectionUsageApi: routes.accountConnectionUsageApi,
			accountPasskeysApi: routes.accountPasskeysApi,
			accountPasskeysApiPost: routes.accountPasskeysApiPost,
			accountMcpOauthClientsApi: routes.accountMcpOauthClientsApi,
			accountMcpOauthClientsApiPost: routes.accountMcpOauthClientsApiPost,
			accountProfileApi: routes.accountProfileApi,
			accountProfileApiPost: routes.accountProfileApiPost,
			accountAvatarApiPost: routes.accountAvatarApiPost,
			accountTwoFactorApi: routes.accountTwoFactorApi,
			accountTwoFactorApiPost: routes.accountTwoFactorApiPost,
			accountBillingCancellationFeedbackPost:
				routes.accountBillingCancellationFeedbackPost,
			accountCredits: routes.accountCredits,
			accountCreditsTopUpPost: routes.accountCreditsTopUpPost,
			accountCreditsSettingsPost: routes.accountCreditsSettingsPost,
			accountUsageApi: routes.accountUsageApi,
			accountWaitingApi: routes.accountWaitingApi,
			accountWaitingClickPost: routes.accountWaitingClickPost,
			accountExperimentsApi: routes.accountExperimentsApi,
			accountExperimentsApiPost: routes.accountExperimentsApiPost,
			accountEmailChange: routes.accountEmailChange,
			accountEmailDestinationsApi: routes.accountEmailDestinationsApi,
			accountEmailDestinationsApiPost: routes.accountEmailDestinationsApiPost,
			accountEmailClaimRelease: routes.accountEmailClaimRelease,
			accountPassword: routes.accountPassword,
			accountResendVerification: routes.accountResendVerification,
			accountSecretsApi: routes.accountSecretsApi,
			accountSecretsApiPost: routes.accountSecretsApiPost,
			accountSecretProvidersApi: routes.accountSecretProvidersApi,
			accountSecretProvidersApiPost: routes.accountSecretProvidersApiPost,
			accountValuesApi: routes.accountValuesApi,
			accountValuesApiPost: routes.accountValuesApiPost,
			accountJobsApi: routes.accountJobsApi,
			accountJobsApiPost: routes.accountJobsApiPost,
			accountWorkflowsApi: routes.accountWorkflowsApi,
			accountWorkflowsApiPost: routes.accountWorkflowsApiPost,
			accountWebhooksApi: routes.accountWebhooksApi,
			accountWebhooksApproveApplyApi: routes.accountWebhooksApproveApplyApi,
			accountWebhooksApproveApplyApiPost:
				routes.accountWebhooksApproveApplyApiPost,
			accountActivityApi: routes.accountActivityApi,
			accountMemoriesExport: routes.accountMemoriesExport,
			accountMemoriesApi: routes.accountMemoriesApi,
			accountMemoriesApiPost: routes.accountMemoriesApiPost,
			accountEmailApi: routes.accountEmailApi,
			admin: routes.admin,
			adminUsersApi: routes.adminUsersApi,
			adminUsersApiPost: routes.adminUsersApiPost,
			adminReservedUsernamesApi: routes.adminReservedUsernamesApi,
			adminReservedUsernamesApiPost: routes.adminReservedUsernamesApiPost,
			adminFeatureFlagsApi: routes.adminFeatureFlagsApi,
			adminFeatureFlagsApiPost: routes.adminFeatureFlagsApiPost,
			adminPlatformIntegrationsApi: routes.adminPlatformIntegrationsApi,
			adminPlatformIntegrationsApiPost: routes.adminPlatformIntegrationsApiPost,
			adminProviderMarksApi: routes.adminProviderMarksApi,
			adminProviderMarksApiPost: routes.adminProviderMarksApiPost,
			adminCodemodsApi: routes.adminCodemodsApi,
			adminCodemodsRunApi: routes.adminCodemodsRunApi,
			adminCodemodsRunStopApi: routes.adminCodemodsRunStopApi,
			adminRolesApi: routes.adminRolesApi,
			adminCommunityReportsApi: routes.adminCommunityReportsApi,
			adminCommunityReportsApiPost: routes.adminCommunityReportsApiPost,
			adminUserUsageApi: routes.adminUserUsageApi,
			adminUserCreditsApi: routes.adminUserCreditsApi,
			adminUserCreditsApiPost: routes.adminUserCreditsApiPost,
			adminOrgLimitsApi: routes.adminOrgLimitsApi,
			adminOrgLimitsApiPost: routes.adminOrgLimitsApiPost,
			adminInsightsApi: routes.adminInsightsApi,
			adminPlatformFeedbackApi: routes.adminPlatformFeedbackApi,
			adminSystemEmailApi: routes.adminSystemEmailApi,
			adminSystemEmailApiPost: routes.adminSystemEmailApiPost,
			communityApi: routes.communityApi,
			communityDetailApi: routes.communityDetailApi,
			communityDetailFilesApi: routes.communityDetailFilesApi,
			communityDetailRaw: routes.communityDetailRaw,
			communityPackageApi: routes.communityPackageApi,
			communityPackageRaw: routes.communityPackageRaw,
			communityPackageFilesApi: routes.communityPackageFilesApi,
			communityPackageAsset: routes.communityPackageAsset,
			communityDetailAsset: routes.communityDetailAsset,
			communityDetailIcon: routes.communityDetailIcon,
			communityPackageIcon: routes.communityPackageIcon,
			accountRepoIcon: routes.accountRepoIcon,
			integrationLogo: routes.integrationLogo,
			providerMarkLogo: routes.providerMarkLogo,
			communityDetailOgImage: routes.communityDetailOgImage,
			communityReportApiPost: routes.communityReportApiPost,
			communityTrustApiPost: routes.communityTrustApiPost,
			communityFeatureApiPost: routes.communityFeatureApiPost,
			communityInstallApiPost: routes.communityInstallApiPost,
			orgBillingApi: routes.orgBillingApi,
			orgBillingCheckoutPost: routes.orgBillingCheckoutPost,
			orgBillingPortal: routes.orgBillingPortal,
			orgMcpServerAuthorizePost: routes.orgMcpServerAuthorizePost,
			orgPackagesApi: routes.orgPackagesApi,
			orgRepositoriesApi: routes.orgRepositoriesApi,
			orgSettingsApi: routes.orgSettingsApi,
			orgSettingsPost: routes.orgSettingsPost,
			orgSettingsAvatarPost: routes.orgSettingsAvatarPost,
			orgSettingsDeletePost: routes.orgSettingsDeletePost,
			orgMembersApi: routes.orgMembersApi,
			orgMembersRolePost: routes.orgMembersRolePost,
			orgMembersRemovePost: routes.orgMembersRemovePost,
			orgMembersInvitePost: routes.orgMembersInvitePost,
			orgMembersInviteLinksPost: routes.orgMembersInviteLinksPost,
			orgMembersInviteLinksRevokePost: routes.orgMembersInviteLinksRevokePost,
			orgInviteJoinPost: routes.orgInviteJoinPost,
			orgTeamsApi: routes.orgTeamsApi,
			orgTeamsCreatePost: routes.orgTeamsCreatePost,
			orgTeamsMemberAddPost: routes.orgTeamsMemberAddPost,
			orgTeamsMemberRemovePost: routes.orgTeamsMemberRemovePost,
			orgGrantsApi: routes.orgGrantsApi,
			orgGrantsRevokePost: routes.orgGrantsRevokePost,
			orgCollaboratorsApi: routes.orgCollaboratorsApi,
			orgAvatar: routes.orgAvatar,
			profileApi: routes.profileApi,
			profileAvatar: routes.profileAvatar,
			profileOgImage: routes.profileOgImage,
			webhookIngress: routes.webhookIngress,
			stripeWebhook: routes.stripeWebhook,
			auth: routes.auth,
			authProvidersApi: routes.authProvidersApi,
			authProviderStart: routes.authProviderStart,
			authProviderCallback: routes.authProviderCallback,
			session: routes.session,
			logout: routes.logout,
			passwordResetRequest: routes.passwordResetRequest,
			passwordResetConfirm: routes.passwordResetConfirm,
			verifyTwoFactorApi: routes.verifyTwoFactorApi,
			webauthnRegistration: routes.webauthnRegistration,
			webauthnRegistrationPost: routes.webauthnRegistrationPost,
			webauthnAuthentication: routes.webauthnAuthentication,
			webauthnAuthenticationPost: routes.webauthnAuthenticationPost,
		},
		{
			actions: {
				landingHeroVideosApi: createLandingHeroVideosApiHandler(env),
				robotsTxt: createRobotsTxtHandler(env),
				sitemap: createSitemapHandler(env),
				authMarkdown: createAuthMarkdownHandler(env),
				mcpServerCard: createMcpServerCardHandler(env),
				apiCatalog: createApiCatalogHandler(env),
				agentSkillsIndex: createAgentSkillsIndexHandler(env),
				agentSkillMarkdown: createAgentSkillMarkdownHandler(env),
				securityTxt: createSecurityTxtHandler(env),
				openaiAppsChallenge: createOpenaiAppsChallengeHandler(env),
				health: createHealthHandler(env),
				healthComponents: createHealthComponentsHandler(env),
				sentryTunnel: createSentryTunnelHandler(env),
				ogPageImage: createOgPageImageHandler(env),
				blogApi: createBlogApiHandler(env),
				blogRss: createBlogRssHandler(env),
				blogPostApi: createBlogPostApiHandler(env),
				blogPostMarkdown: createBlogPostMarkdownHandler(env),
				blogPostOgImage: createBlogPostOgImageHandler(env),
				docsApi: createDocsApiHandler(env),
				docsMarkdown: createDocsMarkdownHandler(env),
				docsLlmsTxt: createDocsLlmsTxtHandler(env),
				docsConnectApi: createDocsConnectApiHandler(env),
				docsConnectMarkdown: createDocsConnectMarkdownHandler(env),
				docDetailApi: createDocDetailApiHandler(env),
				docDetailMarkdown: createDocDetailMarkdownHandler(env),
				docDetailOgImage: createDocDetailOgImageHandler(env),
				packageSkillsOptInPost: createPackageSkillsOptInHandler(env),
				mcpEventsOptInPost: createMcpEventsOptInHandler(env),
				llmsTxt: createLlmsTxtHandler(env),
				legacyGuides: createLegacyGuidesRedirectHandler(env),
				legacyGuidesApi: createLegacyGuidesApiRedirectHandler(env),
				legacyGuidesMarkdown: createLegacyGuidesMarkdownRedirectHandler(env),
				legacyGuidesPath: createLegacyGuidesPathRedirectHandler(env),
				discordApi: createDiscordApiHandler(env),
				onboardingApi: createOnboardingApiHandler(env),
				onboardingChecklistDismissPost:
					createOnboardingChecklistDismissHandler(env),
				youtubeThumb: createYoutubeThumbHandler(env),
				accountOrganizationsApi: createAccountOrganizationsApiHandler(env),
				accountOrganizationsNewPost:
					createAccountOrganizationsNewPostHandler(env),
				accountDelete: createAccountDeleteHandler(env),
				accountExport: createAccountExportHandler(env),
				accountIntegrationsApi: createAccountIntegrationsApiHandler(env),
				accountIntegrationsApiPost: createAccountIntegrationsApiHandler(env),
				accountMcpServerLogo: createMcpServerLogoHandler(env),
				accountMcpServersOauthCallback:
					createAccountMcpServersOauthCallbackHandler(env),
				accountMcpServersApi: createAccountMcpServersApiHandler(env),
				accountMcpServersApiPost: createAccountMcpServersApiHandler(env),
				accountPackageApproveCapabilitiesApi:
					createAccountPackageApproveCapabilitiesApiHandler(env),
				communityPackageApproveCapabilitiesApi:
					createAccountPackageApproveCapabilitiesApiHandler(env),
				accountPackageApprovePublishApi:
					createAccountPackageApprovePublishApiHandler(env),
				communityPackageApprovePublishApi:
					createAccountPackageApprovePublishApiHandler(env),
				communityPackageWebhooksApi:
					createCommunityPackageWebhooksApiHandler(env),
				communityPackageWebhooksApiPost:
					createCommunityPackageWebhooksApiHandler(env),
				accountPackageFilesApi: createAccountPackageFilesApiHandler(env),
				accountPackagesApi: createAccountPackagesApiHandler(env),
				accountPackagesApiPost: createAccountPackagesApiHandler(env),
				accountConnectionsApi: createAccountConnectionsApiHandler(env),
				accountConnectionsApiPost: createAccountConnectionsApiHandler(env),
				accountConnectedAgentsApi: createAccountConnectedAgentsApiHandler(env),
				accountConnectedAgentsApiPost:
					createAccountConnectedAgentsApiHandler(env),
				accountConnectionUsageApi: createAccountConnectionUsageApiHandler(env),
				accountPasskeysApi: createAccountPasskeysApiHandler(env),
				accountPasskeysApiPost: createAccountPasskeysApiHandler(env),
				accountMcpOauthClientsApi: createAccountMcpOauthClientsApiHandler(env),
				accountMcpOauthClientsApiPost:
					createAccountMcpOauthClientsApiHandler(env),
				accountProfileApi: createAccountProfileApiHandler(env),
				accountProfileApiPost: createAccountProfileApiHandler(env),
				accountAvatarApiPost: createAccountAvatarApiPostHandler(env),
				accountTwoFactorApi: createAccountTwoFactorApiHandler(env),
				accountTwoFactorApiPost: createAccountTwoFactorApiHandler(env),
				accountBillingCancellationFeedbackPost:
					createAccountBillingCancellationFeedbackApiHandler(env),
				accountCredits: createAccountCreditsHandler(),
				accountCreditsTopUpPost: createAccountCreditsTopUpApiHandler(env),
				accountCreditsSettingsPost: createAccountCreditsSettingsApiHandler(env),
				accountUsageApi: createAccountUsageApiHandler(env),
				accountWaitingApi: createAccountWaitingApiHandler(env),
				accountWaitingClickPost: createAccountWaitingClickHandler(env),
				accountExperimentsApi: createAccountExperimentsApiHandler(env),
				accountExperimentsApiPost: createAccountExperimentsApiHandler(env),
				accountEmailChange: createAccountEmailChangeHandler(env),
				accountEmailDestinationsApi: createAccountEmailDestinationsHandler(env),
				accountEmailDestinationsApiPost:
					createAccountEmailDestinationsHandler(env),
				accountEmailClaimRelease: createAccountEmailClaimReleaseHandler(env),
				accountPassword: createAccountPasswordHandler(env),
				accountResendVerification: createAccountResendVerificationHandler(env),
				accountSecretsApi: createAccountSecretsApiHandler(env),
				accountSecretsApiPost: createAccountSecretsApiHandler(env),
				accountSecretProvidersApi: createAccountSecretProvidersApiHandler(env),
				accountSecretProvidersApiPost:
					createAccountSecretProvidersApiHandler(env),
				accountValuesApi: createAccountValuesApiHandler(env),
				accountValuesApiPost: createAccountValuesApiHandler(env),
				accountJobsApi: createAccountJobsApiHandler(env),
				accountJobsApiPost: createAccountJobsApiHandler(env),
				accountWorkflowsApi: createAccountWorkflowsApiHandler(env),
				accountWorkflowsApiPost: createAccountWorkflowsApiHandler(env),
				accountWebhooksApi: createAccountWebhooksApiHandler(env),
				accountWebhooksApproveApplyApi:
					createAccountWebhooksApproveApplyApiHandler(env),
				accountWebhooksApproveApplyApiPost:
					createAccountWebhooksApproveApplyApiHandler(env),
				accountActivityApi: createAccountActivityApiHandler(env),
				accountMemoriesExport: createAccountMemoriesExportHandler(env),
				accountMemoriesApi: createAccountMemoriesApiHandler(env),
				accountMemoriesApiPost: createAccountMemoriesApiHandler(env),
				accountEmailApi: createAccountEmailApiHandler(env),
				admin: createAdminHandler(env),
				adminUsersApi: createAdminUsersApiHandler(env),
				adminUsersApiPost: createAdminUsersApiHandler(env),
				adminReservedUsernamesApi: createAdminReservedUsernamesApiHandler(env),
				adminReservedUsernamesApiPost:
					createAdminReservedUsernamesApiHandler(env),
				adminFeatureFlagsApi: createAdminFeatureFlagsApiHandler(env),
				adminFeatureFlagsApiPost: createAdminFeatureFlagsApiHandler(env),
				adminPlatformIntegrationsApi:
					createAdminPlatformIntegrationsApiHandler(env),
				adminPlatformIntegrationsApiPost:
					createAdminPlatformIntegrationsApiHandler(env),
				adminProviderMarksApi: createAdminProviderMarksApiHandler(env),
				adminProviderMarksApiPost: createAdminProviderMarksApiHandler(env),
				adminCodemodsApi: createAdminCodemodsApiHandler(env),
				adminCodemodsRunApi: createAdminCodemodsRunApiHandler(env),
				adminCodemodsRunStopApi: createAdminCodemodsRunStopApiHandler(env),
				adminRolesApi: createAdminRolesApiHandler(env),
				adminCommunityReportsApi: createAdminCommunityReportsApiHandler(env),
				adminCommunityReportsApiPost:
					createAdminCommunityReportsApiHandler(env),
				adminUserUsageApi: createAdminUserUsageApiHandler(env),
				adminUserCreditsApi: createAdminUserCreditsApiHandler(env),
				adminUserCreditsApiPost: createAdminUserCreditsApiHandler(env),
				adminOrgLimitsApi: createAdminOrgLimitsApiHandler(env),
				adminOrgLimitsApiPost: createAdminOrgLimitsApiHandler(env),
				adminInsightsApi: createAdminInsightsApiHandler(env),
				adminPlatformFeedbackApi: createAdminPlatformFeedbackApiHandler(env),
				adminSystemEmailApi: createAdminSystemEmailApiHandler(env),
				adminSystemEmailApiPost: createAdminSystemEmailApiHandler(env),
				communityApi: createCommunityApiHandler(env),
				communityDetailApi: createCommunityDetailApiHandler(env),
				communityDetailFilesApi: createCommunityDetailFilesApiHandler(env),
				communityDetailRaw: createCommunityDetailRawHandler(env),
				communityPackageApi: createCommunityPackageApiHandler(env),
				communityPackageRaw: createCommunityPackageRawHandler(env),
				communityPackageFilesApi: createCommunityPackageFilesApiHandler(env),
				communityPackageAsset: createCommunityPackageAssetHandler(env),
				communityDetailAsset: createCommunityDetailAssetHandler(env),
				communityDetailIcon: createCommunityIconHandler(env),
				communityPackageIcon: createCommunityPackageIconHandler(env),
				accountRepoIcon: createAccountRepoIconHandler(env),
				integrationLogo: createIntegrationLogoHandler(env),
				providerMarkLogo: createProviderMarkLogoHandler(env),
				communityDetailOgImage: createCommunityDetailOgImageHandler(env),
				communityReportApiPost: createCommunityReportApiPostHandler(env),
				communityTrustApiPost: createCommunityTrustApiPostHandler(env),
				communityFeatureApiPost: createCommunityFeatureApiPostHandler(env),
				communityInstallApiPost: createCommunityInstallApiPostHandler(env),
				orgBillingApi: createOrgBillingApiHandler(env),
				orgBillingCheckoutPost: createOrgBillingCheckoutApiHandler(env),
				orgBillingPortal: createOrgBillingPortalHandler(
					env,
					(request, access) =>
						renderDocument(request, { status: access.status }),
				),
				orgMcpServerAuthorizePost: createOrgMcpServerAuthorizePostHandler(env),
				orgPackagesApi: createLegacyOrgPackagesApiRedirectHandler(env),
				orgRepositoriesApi: createOrgRepositoriesApiHandler(env),
				orgSettingsApi: createOrgSettingsApiHandler(env),
				orgSettingsPost: createOrgSettingsPostHandler(env),
				orgSettingsAvatarPost: createOrgSettingsAvatarPostHandler(env),
				orgSettingsDeletePost: createOrgSettingsDeletePostHandler(env),
				orgMembersApi: createOrgMembersApiHandler(env),
				orgMembersRolePost: createOrgMembersRolePostHandler(env),
				orgMembersRemovePost: createOrgMembersRemovePostHandler(env),
				orgMembersInvitePost: createOrgMembersInvitePostHandler(env),
				orgMembersInviteLinksPost: createOrgMembersInviteLinksPostHandler(env),
				orgMembersInviteLinksRevokePost:
					createOrgMembersInviteLinksRevokePostHandler(env),
				orgInviteJoinPost: createOrgInviteJoinPostHandler(env),
				orgTeamsApi: createOrgTeamsApiHandler(env),
				orgTeamsCreatePost: createOrgTeamsCreatePostHandler(env),
				orgTeamsMemberAddPost: createOrgTeamsMemberAddPostHandler(env),
				orgTeamsMemberRemovePost: createOrgTeamsMemberRemovePostHandler(env),
				orgGrantsApi: createOrgGrantsApiHandler(env),
				orgGrantsRevokePost: createOrgGrantsRevokePostHandler(env),
				orgCollaboratorsApi: createOrgCollaboratorsApiHandler(env),
				orgAvatar: createOrgAvatarHandler(env),
				profileApi: createProfileApiHandler(env),
				profileAvatar: createProfileAvatarHandler(env),
				profileOgImage: createProfileOgImageHandler(env),
				webhookIngress: createWebhookIngressHandler(env),
				stripeWebhook: createStripeWebhookHandler(env),
				auth: createAuthHandler(env),
				authProvidersApi: createAuthProvidersApiHandler(env),
				authProviderStart: createAuthProviderStartHandler(env),
				authProviderCallback: createAuthProviderCallbackHandler(env),
				session: createSessionHandler(env),
				logout,
				passwordResetRequest: createPasswordResetRequestHandler(env),
				passwordResetConfirm: createPasswordResetConfirmHandler(env),
				verifyTwoFactorApi: createTwoFactorVerifyApiHandler(env),
				webauthnRegistration: createWebauthnRegistrationHandler(env),
				webauthnRegistrationPost: createWebauthnRegistrationHandler(env),
				webauthnAuthentication: createWebauthnAuthenticationHandler(env),
				webauthnAuthenticationPost: createWebauthnAuthenticationHandler(env),
			},
		},
	)
	return router
}

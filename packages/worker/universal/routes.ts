import { get, post, route } from 'remix/routes'

export const routes = route({
	home: '/',
	notFoundPage: '/404',
	internalErrorPage: '/500',
	robotsTxt: '/robots.txt',
	sitemap: '/sitemap.xml',
	authMarkdown: '/auth.md',
	mcpServerCard: '/.well-known/mcp/server-card.json',
	apiCatalog: '/.well-known/api-catalog',
	agentSkillsIndex: '/.well-known/agent-skills/index.json',
	agentSkillMarkdown: '/.well-known/agent-skills/:skillId/SKILL.md',
	securityTxt: '/.well-known/security.txt',
	openaiAppsChallenge: '/.well-known/openai-apps-challenge',
	connectOauth: '/connect/oauth',
	connectCredential: '/connect/credential',
	accountCredentials: '/account/credentials',
	connectSecrets: '/connect/secrets',
	connectSecretSet: '/connect/secret-set',
	connectWebhookApply: '/connect/webhook-apply',
	integrationLogo: '/integrations/logos/:integrationSlug',
	providerMarkLogo: '/integrations/provider-marks/:slug',
	// Favicon bytes and the OAuth callback stay on `/account`. The servers
	// page itself is `/@:orgSlug/-/mcp-servers`.
	accountMcpServerLogo: '/account/mcp-servers/logos/:serverId',
	accountMcpServersOauthCallback: '/account/mcp-servers/oauth/callback',
	// Package detail still redirects to the canonical `/@user/:kodyId` page.
	// The JSON endpoints remain account-scoped mutation/read APIs.
	accountRepoIcon: '/account/repos/:repoId/icon/:iconCommit',
	accountPackageDetail: '/account/packages/:packageId',
	accountPackageApprovePublish: '/account/packages/:packageId/approve-publish',
	accountPackageApproveCapabilities:
		'/account/packages/:packageId/approve-capabilities',
	accountPackageFiles: '/account/packages/:packageId/files(/*relativePath)',
	accountExperiments: '/account/experiments',
	// Authenticated download, separate from the organization memories page.
	accountMemoriesExport: '/account/memories-export.json',
	accountPasskeys: '/account/passkeys',
	accountMcpOauthClients: '/account/mcp-oauth-clients',
	accountTwoFactor: '/account/two-factor',
	// Old `/account/credits` and `/account/usage` links redirect to the
	// signed-in person's personal-org usage page (and its Credits section).
	accountCredits: '/account/credits',
	accountUsage: '/account/usage',
	accountExport: '/account/export.json',
	admin: '/admin',
	adminUsers: '/admin/users',
	adminUserDetail: '/admin/users/:stableUserId',
	adminRoles: '/admin/roles',
	adminReservedUsernames: '/admin/reserved-usernames',
	adminFeatureFlags: '/admin/feature-flags',
	youtubeThumb: '/youtube-thumb/:videoId',
	adminPlatformIntegrations: '/admin/platform-integrations',
	adminPlatformIntegrationNew: '/admin/platform-integrations/new',
	adminPlatformIntegrationDetail: '/admin/platform-integrations/:slug',
	adminProviderMarks: '/admin/provider-marks',
	adminCodemods: '/admin/codemods',
	adminCommunityReports: '/admin/community-reports',
	adminInsights: '/admin/insights',
	adminPlatformFeedback: '/admin/platform-feedback',
	adminSystemEmail: '/admin/system-email',
	blog: '/blog',
	blogRss: '/blog/rss.xml',
	blogPost: '/blog/:slug',
	blogPostMarkdown: '/blog/:slug.md',
	blogPostOgImage: '/blog/:slug/og.png',
	// `/docs` renders the introduction article (`what-is-kody`); the other
	// Docs live at `/docs/:slug`, with public Markdown at `.md`.
	docs: '/docs',
	docsMarkdown: '/docs.md',
	// Static companions must win over `/docs/:slug` so `connect` and
	// `llms.txt` are not treated as missing doc slugs.
	docsLlmsTxt: '/docs/llms.txt',
	docsConnect: '/docs/connect',
	docsConnectMarkdown: '/docs/connect.md',
	docDetail: '/docs/:slug',
	docDetailMarkdown: '/docs/:slug.md',
	docDetailOgImage: '/docs/:slug/og.png',
	// Signed-in opt-in for the mcp-skills-extension flag from the package skills docs.
	// Signed-in opt-in for the mcp-events-extension flag from the MCP Events docs.
	llmsTxt: '/llms.txt',
	// The docs used to live under `/guides`. Everything there 308s to `/docs`
	// (see `#app/handlers/legacy-guides-redirect.ts`).
	legacyGuides: '/guides',
	legacyGuidesMarkdown: '/guides.md',
	legacyGuidesPath: '/guides/*rest',
	community: '/community',
	communityDetail: '/community/:listingId',
	communityDetailFiles: '/community/:listingId/files(/*relativePath)',
	communityDetailRaw: '/community/:listingId/raw(/*relativePath)',
	communityDetailAsset: '/community/:listingId/assets(/*relativePath)',
	communityDetailIcon: '/community/:listingId/icon/:iconCommit',
	communityDetailOgImage: '/community/:listingId/og.png',
	// Organization section pages under `/@:orgSlug/-/…` so they never collide
	// with a package's canonical public URL at `/@:username/:kodyId`.
	// `repositories` and `webhooks` are index-only so package apps and ingress
	// (`/@owner/packages/…`, `/@owner/webhooks/…`) stay put.
	orgActivity: get('/@:orgSlug/-/activity(/*rest)'),
	orgAgents: get('/@:orgSlug/-/agents(/*rest)'),
	orgBilling: get('/@:orgSlug/-/billing'),
	orgBillingSuccess: get('/@:orgSlug/-/billing/success'),
	orgBillingPortal: get('/@:orgSlug/-/billing/portal'),
	orgCredentials: get('/@:orgSlug/-/credentials(/*rest)'),
	// The credential creation one-pager for this org.
	orgCredentialNew: get('/@:orgSlug/-/credentials/new'),
	orgUsage: get('/@:orgSlug/-/usage'),
	orgEmail: get('/@:orgSlug/-/email(/*rest)'),
	orgIntegrations: get('/@:orgSlug/-/integrations(/*rest)'),
	orgJobs: get('/@:orgSlug/-/jobs(/*rest)'),
	orgMcpServers: get('/@:orgSlug/-/mcp-servers(/*rest)'),
	// Every MCP server `authUrl` opens this consent page. Continue posts back
	// here and is redirected to the provider.
	orgMcpServerAuthorize: get('/@:orgSlug/-/mcp-servers/:serverId/authorize'),
	orgMemories: get('/@:orgSlug/-/memories(/*rest)'),
	orgOverview: get('/@:orgSlug/-/overview'),
	orgRepositories: get('/@:orgSlug/-/repositories'),
	// Previous spelling of the repository list. 301 to `/repositories`.
	orgPackages: get('/@:orgSlug/-/packages'),
	// Previous name of the Agents page. 301 to `/agents` (rest and query kept).
	orgConnections: get('/@:orgSlug/-/connections(/*rest)'),
	orgSecretProviders: get('/@:orgSlug/-/secret-providers(/*rest)'),
	orgSecrets: get('/@:orgSlug/-/secrets(/*rest)'),
	orgValues: get('/@:orgSlug/-/values(/*rest)'),
	orgWaiting: get('/@:orgSlug/-/waiting(/*rest)'),
	orgWebhooks: get('/@:orgSlug/-/webhooks'),
	orgWorkflows: get('/@:orgSlug/-/workflows(/*rest)'),
	// Org settings and members under the same `/-/` separator.
	orgSettings: get('/@:orgSlug/-/settings'),
	orgMembers: get('/@:orgSlug/-/members'),
	orgInviteJoin: get('/join/:token'),
	orgTeams: get('/@:orgSlug/-/teams'),
	orgGrants: get('/@:orgSlug/-/grants'),
	orgCollaborators: get('/@:orgSlug/-/collaborators'),
	orgAvatar: get('/orgs/:orgSlug/avatar/:hash.:ext'),
	profile: '/@:username',
	// Canonical public URL for a published package, keyed by its owner and
	// package name leaf (`/@acme/devin`) rather than the listing uuid. Deeper
	// package routes use a third-segment noun (`/files`) so they do not collide
	// with `/@:username/{packages,connectors,webhooks,api}` ingress.
	communityPackage: '/@:username/:kodyId',
	communityPackageFiles: '/@:username/:kodyId/files(/*relativePath)',
	communityPackageTree: '/@:username/:kodyId/tree/:ref(/*relativePath)',
	communityPackageRaw: '/@:username/:kodyId/raw/:ref(/*relativePath)',
	// First-party bytes for README-relative images. Third-segment noun so
	// `/@:username/packages/…` stays the hosted package-app mount.
	communityPackageAsset: '/@:username/:kodyId/assets(/*relativePath)',
	// Repo/list identity mark for a saved package (public when the package is
	// public). Third-segment noun so it cannot collide with a kodyId.
	communityPackageIcon: '/@:username/:kodyId/icon/:iconCommit',
	communityPackageSettings: '/@:username/:kodyId/settings',
	// Package Credentials / Default mappings / Triggers tabs (people with
	// package:execute); Start loads the credential view.
	communityPackageCredentials: '/@:username/:kodyId/credentials',
	communityPackageMappings: '/@:username/:kodyId/mappings',
	communityPackageTriggers: '/@:username/:kodyId/triggers',
	// Bundled credential mapping approval; the query is the proposal
	// (buildCredentialApprovalHref). Start loads the approval view.
	communityPackageApproveCredentials: '/@:username/:kodyId/approve-credentials',
	communityPackageApprovePublish: '/@:username/:kodyId/approve-publish',
	communityPackageApproveCapabilities:
		'/@:username/:kodyId/approve-capabilities',
	// `.` is a Remix route delimiter, so the filename must be `:hash.:ext`
	// (not a single `:cacheKey`) or `/avatar/abc.jpg` never matches.
	profileAvatar: '/profiles/:username/avatar/:hash.:ext',
	profileOgImage: '/profiles/:username/og.png',
	webhookIngress: post(
		'/@:username/webhooks/:packageKodyId/:webhookName/:urlSecret',
	),
	stripeWebhook: post('/webhooks/stripe'),
	health: '/health',
	healthComponents: '/health/components',
	sentryTunnel: post('/sentry-tunnel'),
	login: '/login',
	ogPageImage: '/og/:page.png',
	features: '/features',
	featureMemory: '/features/memory',
	featureSecrets: '/features/secrets',
	featurePackages: '/features/packages',
	featureTriggers: '/features/triggers',
	featureIntegrations: '/features/integrations',
	featureApps: '/features/apps',
	business: '/for/business',
	pricing: get('/pricing'),
	faq: '/faq',
	caseStudies: '/case-studies',
	n8nAlternatives: '/compare/n8n-alternatives',
	mcpGateway: '/use-cases/mcp-gateway',
	sharedMemory: '/use-cases/shared-agent-memory',
	gmail: '/integrations/gmail',
	customTools: '/use-cases/claude-code-custom-tools',
	composioAlternatives: '/compare/composio-alternatives',
	slack: '/integrations/slack',
	scheduledWorkflows: '/use-cases/scheduled-workflows',
	claudeIntegrations: '/integrations/claude',
	useCases: '/use-cases',
	automation: '/use-cases/ai-workflow-automation',

	support: '/support',
	privacy: '/privacy',
	terms: '/terms',
	discord: '/discord',
	onboarding: '/onboarding',
	onboardingStep1: '/onboarding/step-1',
	onboardingStep1Agent: '/onboarding/step-1/:agent',
	onboardingStep2: '/onboarding/step-2',
	onboardingStep2Service: '/onboarding/step-2/:service',
	onboardingStep3: '/onboarding/step-3',
	onboardingStep3Agent: '/onboarding/step-3/:agent',
	resetPassword: '/reset-password',
	verify: '/verify',
	verifyEmail: '/verify-email',
	verifyEmailChange: '/verify-email-change',
	verifyEmailClaimRelease: '/verify-email-claim-release',
	verifyEmailDestination: '/verify-email-destination',
	unsubscribeTips: '/unsubscribe/tips',
	pendingVerification: '/pending-verification',
	signup: '/signup',
	account: '/account',
	accountSecurity: '/account/security',
	accountData: '/account/data',
	accountOrganizations: '/account/organizations',
	accountOrganizationsNew: get('/account/organizations/new'),
	auth: post('/auth'),
	authProviderCallback: '/auth/:provider/callback',
	session: '/session',
	webauthnRegistration: '/webauthn/registration',
	webauthnAuthentication: '/webauthn/authentication',
})

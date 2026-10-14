import { env } from 'cloudflare:workers'
import { getEnv } from '#app/env.ts'
import { RequestContext } from 'remix/router'
import {
	createRobotsTxtHandler,
	createSitemapHandler,
	createAuthMarkdownHandler,
	createMcpServerCardHandler,
	createApiCatalogHandler,
	createAgentSkillsIndexHandler,
	createAgentSkillMarkdownHandler,
	createSecurityTxtHandler,
	createOpenaiAppsChallengeHandler,
} from '#app/handlers/agent-discovery.ts'
import { createHealthHandler } from '#app/handlers/health.ts'
import { createHealthComponentsHandler } from '#app/handlers/health-components.ts'
import { createSentryTunnelHandler } from '#app/handlers/sentry-tunnel.ts'
import { createOgPageImageHandler } from '#app/handlers/og-page-image.ts'
import {
	createBlogRssHandler,
	createBlogPostMarkdownHandler,
	createBlogPostOgImageHandler,
} from '#app/handlers/blog.tsx'
import {
	createDocsMarkdownHandler,
	createDocsLlmsTxtHandler,
	createDocsConnectMarkdownHandler,
	createDocDetailMarkdownHandler,
	createDocDetailOgImageHandler,
	createLlmsTxtHandler,
} from '#app/handlers/docs.tsx'
import { createYoutubeThumbHandler } from '#app/handlers/youtube-thumb.ts'
import { createAccountExportHandler } from '#app/handlers/account-export.ts'
import { createMcpServerLogoHandler } from '#app/handlers/mcp-server-logo.ts'
import { createAccountMcpServersOauthCallbackHandler } from '#app/handlers/account-mcp-servers.ts'
import { createAccountMemoriesExportHandler } from '#app/handlers/account-memories.ts'
import {
	createCommunityDetailRawHandler,
	createCommunityPackageRawHandler,
} from '#app/handlers/package-files-raw.ts'
import {
	createCommunityPackageAssetHandler,
	createCommunityDetailAssetHandler,
} from '#app/handlers/package-readme-assets.ts'
import { createCommunityIconHandler } from '#app/handlers/community-icon.ts'
import { createCommunityPackageIconHandler } from '#app/handlers/community-package-icon.ts'
import { createAccountRepoIconHandler } from '#app/handlers/account-repo-icon.ts'
import { createIntegrationLogoHandler } from '#app/handlers/integration-logo.ts'
import { createProviderMarkLogoHandler } from '#app/handlers/provider-mark-logo.ts'
import { createCommunityDetailOgImageHandler } from '#app/handlers/community-detail.tsx'
import { createOrgAvatarHandler } from '#app/handlers/org-avatar.ts'
import { createProfileAvatarHandler } from '#app/handlers/profile-avatar.ts'
import { createProfileOgImageHandler } from '#app/handlers/profile.tsx'
import { createWebhookIngressHandler } from '#app/handlers/webhook-ingress.ts'
import { createStripeWebhookHandler } from '#app/handlers/stripe-webhook.ts'
import { createAuthHandler } from '#app/handlers/auth.ts'
import { createAuthProviderCallbackHandler } from '#app/handlers/auth-provider.ts'
import { createSessionHandler } from '#app/handlers/session.ts'

/** Existing protocol business handlers receive their typed request parameters. Start owns matching and method dispatch. */
function httpContext<P extends Record<string, string>>(
	request: Request,
	params: P,
) {
	const context = new RequestContext<P>(request)
	context.params = params
	return context
}

export const robotsTxtHttp = ({ request }: { request: Request; params: {} }) =>
	createRobotsTxtHandler(getEnv(env)).handler(httpContext(request, {}))

export const sitemapHttp = ({ request }: { request: Request; params: {} }) =>
	createSitemapHandler(getEnv(env)).handler(httpContext(request, {}))

export const authMarkdownHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createAuthMarkdownHandler(getEnv(env)).handler(httpContext(request, {}))

export const mcpServerCardHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createMcpServerCardHandler(getEnv(env)).handler(httpContext(request, {}))

export const apiCatalogHttp = ({ request }: { request: Request; params: {} }) =>
	createApiCatalogHandler(getEnv(env)).handler(httpContext(request, {}))

export const agentSkillsIndexHttp = ({
	request,
}: {
	request: Request
	params: {}
}) =>
	createAgentSkillsIndexHandler(getEnv(env)).handler(httpContext(request, {}))

export const agentSkillMarkdownHttp = ({
	request,
	params,
}: {
	request: Request
	params: { skillId: string }
}) =>
	createAgentSkillMarkdownHandler(getEnv(env)).handler(
		httpContext(request, { skillId: params.skillId }),
	)

export const securityTxtHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createSecurityTxtHandler(getEnv(env)).handler(httpContext(request, {}))

export const openaiAppsChallengeHttp = () =>
	createOpenaiAppsChallengeHandler(getEnv(env)).handler()

export const healthHttp = ({ request }: { request: Request; params: {} }) =>
	createHealthHandler(getEnv(env)).handler(httpContext(request, {}))

const healthCollectors = new WeakMap<
	Env,
	ReturnType<typeof createHealthComponentsHandler>
>()
export const healthComponentsHttp = () => {
	const bindings = getEnv(env)
	let collector = healthCollectors.get(bindings)
	if (!collector) {
		collector = createHealthComponentsHandler(bindings)
		healthCollectors.set(bindings, collector)
	}
	return collector.handler()
}

export const sentryTunnelHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createSentryTunnelHandler(getEnv(env)).handler(httpContext(request, {}))

export const ogPageImageHttp = ({
	request,
	params,
}: {
	request: Request
	params: { page: string }
}) =>
	createOgPageImageHandler(getEnv(env)).handler(
		httpContext(request, { page: params.page }),
	)

export const blogRssHttp = ({ request }: { request: Request; params: {} }) =>
	createBlogRssHandler(getEnv(env)).handler(httpContext(request, {}))

export const blogPostMarkdownHttp = ({
	request,
	params,
}: {
	request: Request
	params: { slug: string }
}) =>
	createBlogPostMarkdownHandler(getEnv(env)).handler(
		httpContext(request, { slug: params.slug }),
	)

export const blogPostOgImageHttp = ({
	request,
	params,
}: {
	request: Request
	params: { slug: string }
}) =>
	createBlogPostOgImageHandler(getEnv(env)).handler(
		httpContext(request, { slug: params.slug }),
	)

export const docsMarkdownHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createDocsMarkdownHandler(getEnv(env)).handler(httpContext(request, {}))

export const docsLlmsTxtHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createDocsLlmsTxtHandler(getEnv(env)).handler(httpContext(request, {}))

export const docsConnectMarkdownHttp = ({
	request,
}: {
	request: Request
	params: {}
}) =>
	createDocsConnectMarkdownHandler(getEnv(env)).handler(
		httpContext(request, {}),
	)

export const docDetailMarkdownHttp = ({
	request,
	params,
}: {
	request: Request
	params: { slug: string }
}) =>
	createDocDetailMarkdownHandler(getEnv(env)).handler(
		httpContext(request, { slug: params.slug }),
	)

export const docDetailOgImageHttp = ({
	request,
	params,
}: {
	request: Request
	params: { slug: string }
}) =>
	createDocDetailOgImageHandler(getEnv(env)).handler(
		httpContext(request, { slug: params.slug }),
	)

export const llmsTxtHttp = ({ request }: { request: Request; params: {} }) =>
	createLlmsTxtHandler(getEnv(env)).handler(httpContext(request, {}))

export const youtubeThumbHttp = ({
	request,
	params,
}: {
	request: Request
	params: { videoId: string }
}) =>
	createYoutubeThumbHandler(getEnv(env)).handler(
		httpContext(request, { videoId: params.videoId }),
	)

export const accountExportHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createAccountExportHandler(getEnv(env)).handler(httpContext(request, {}))

export const accountMcpServerLogoHttp = ({
	request,
	params,
}: {
	request: Request
	params: { serverId: string }
}) =>
	createMcpServerLogoHandler(getEnv(env)).handler(
		httpContext(request, { serverId: params.serverId }),
	)

export const accountMcpServersOauthCallbackHttp = ({
	request,
}: {
	request: Request
	params: {}
}) =>
	createAccountMcpServersOauthCallbackHandler(getEnv(env)).handler(
		httpContext(request, {}),
	)

export const accountMemoriesExportHttp = ({
	request,
}: {
	request: Request
	params: {}
}) =>
	createAccountMemoriesExportHandler(getEnv(env)).handler(
		httpContext(request, {}),
	)

export const communityDetailRawHttp = ({
	request,
	params,
}: {
	request: Request
	params: { listingId: string; _splat?: string }
}) =>
	createCommunityDetailRawHandler(getEnv(env)).handler(
		httpContext(request, {
			listingId: params.listingId,
			relativePath: params._splat ?? '',
		}),
	)

export const communityPackageRawHttp = ({
	request,
	params,
}: {
	request: Request
	params: { username: string; kodyId: string; ref: string; _splat?: string }
}) =>
	createCommunityPackageRawHandler(getEnv(env)).handler(
		httpContext(request, {
			username: params.username,
			kodyId: params.kodyId,
			ref: params.ref,
			relativePath: params._splat ?? '',
		}),
	)

export const communityPackageAssetHttp = ({
	request,
	params,
}: {
	request: Request
	params: { username: string; kodyId: string; _splat?: string }
}) =>
	createCommunityPackageAssetHandler(getEnv(env)).handler(
		httpContext(request, {
			username: params.username,
			kodyId: params.kodyId,
			relativePath: params._splat ?? '',
		}),
	)

export const communityDetailAssetHttp = ({
	request,
	params,
}: {
	request: Request
	params: { listingId: string; _splat?: string }
}) =>
	createCommunityDetailAssetHandler(getEnv(env)).handler(
		httpContext(request, {
			listingId: params.listingId,
			relativePath: params._splat ?? '',
		}),
	)

export const communityDetailIconHttp = ({
	request,
	params,
}: {
	request: Request
	params: { listingId: string; iconCommit: string }
}) =>
	createCommunityIconHandler(getEnv(env)).handler(
		httpContext(request, {
			listingId: params.listingId,
			iconCommit: params.iconCommit,
		}),
	)

export const communityPackageIconHttp = ({
	request,
	params,
}: {
	request: Request
	params: { username: string; kodyId: string; iconCommit: string }
}) =>
	createCommunityPackageIconHandler(getEnv(env)).handler(
		httpContext(request, {
			username: params.username,
			kodyId: params.kodyId,
			iconCommit: params.iconCommit,
		}),
	)

export const accountRepoIconHttp = ({
	request,
	params,
}: {
	request: Request
	params: { repoId: string; iconCommit: string }
}) =>
	createAccountRepoIconHandler(getEnv(env)).handler(
		httpContext(request, {
			repoId: params.repoId,
			iconCommit: params.iconCommit,
		}),
	)

export const integrationLogoHttp = ({
	request,
	params,
}: {
	request: Request
	params: { integrationSlug: string }
}) =>
	createIntegrationLogoHandler(getEnv(env)).handler(
		httpContext(request, { integrationSlug: params.integrationSlug }),
	)

export const providerMarkLogoHttp = ({
	request,
	params,
}: {
	request: Request
	params: { slug: string }
}) =>
	createProviderMarkLogoHandler(getEnv(env)).handler(
		httpContext(request, { slug: params.slug }),
	)

export const communityDetailOgImageHttp = ({
	request,
	params,
}: {
	request: Request
	params: { listingId: string }
}) =>
	createCommunityDetailOgImageHandler(getEnv(env)).handler(
		httpContext(request, { listingId: params.listingId }),
	)

export const orgAvatarHttp = ({
	request,
	params,
}: {
	request: Request
	params: { orgSlug: string; hash: string; ext: string }
}) =>
	createOrgAvatarHandler(getEnv(env)).handler(
		httpContext(request, {
			orgSlug: params.orgSlug,
			hash: params.hash,
			ext: params.ext,
		}),
	)

export const profileAvatarHttp = ({
	request,
	params,
}: {
	request: Request
	params: { username: string; hash: string; ext: string }
}) =>
	createProfileAvatarHandler(getEnv(env)).handler(
		httpContext(request, {
			username: params.username,
			hash: params.hash,
			ext: params.ext,
		}),
	)

export const profileOgImageHttp = ({
	request,
	params,
}: {
	request: Request
	params: { username: string }
}) =>
	createProfileOgImageHandler(getEnv(env)).handler(
		httpContext(request, { username: params.username }),
	)

export const webhookIngressHttp = ({
	request,
	params,
}: {
	request: Request
	params: {
		username: string
		packageKodyId: string
		webhookName: string
		urlSecret: string
	}
}) =>
	createWebhookIngressHandler(getEnv(env)).handler(
		httpContext(request, {
			username: params.username,
			packageKodyId: params.packageKodyId,
			webhookName: params.webhookName,
			urlSecret: params.urlSecret,
		}),
	)

export const stripeWebhookHttp = ({
	request,
}: {
	request: Request
	params: {}
}) => createStripeWebhookHandler(getEnv(env)).handler(httpContext(request, {}))

export const authHttp = ({ request }: { request: Request; params: {} }) =>
	createAuthHandler(getEnv(env)).handler(httpContext(request, {}))

export const authProviderCallbackHttp = ({
	request,
	params,
}: {
	request: Request
	params: { provider: string }
}) =>
	createAuthProviderCallbackHandler(getEnv(env)).handler(
		httpContext(request, { provider: params.provider }),
	)

export const sessionHttp = ({ request }: { request: Request; params: {} }) =>
	createSessionHandler(getEnv(env)).handler(httpContext(request, {}))

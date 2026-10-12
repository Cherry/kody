import { actionPagePaths } from './action-pages.ts'
/** Routes with a native React implementation in the comparison candidate. */
const migratedPaths = new Set([
	'/',
	'/pending-verification',
	'/oauth/authorize',
	'/oauth/callback',
	'/account',
	'/account/passkeys',
	'/account/two-factor',
	'/account/memories',
	'/account/values',
	'/account/secrets',
	'/account/secrets/new',
	'/account/secrets/approve',
	'/account/secret-providers',
	'/account/secret-providers/approve',
	'/account/jobs',
	'/account/workflows',
	'/account/activity',
	'/account/waiting',
	'/account/experiments',
	'/account/billing',
	'/account/usage',
	'/account/connections',
	'/account/connections/new',
	'/account/mcp-oauth-clients',
	'/account/webhooks',
	'/account/email',
	'/account/integrations',
	'/account/mcp-servers',
	'/account/shared',
	'/account/packages',

	'/admin/feature-flags',
	'/admin/insights',
	'/admin/provider-marks',
	'/admin/banners',
	'/admin/users',
	'/admin/roles',
	'/admin/system-email',
	'/admin/reserved-usernames',
	'/admin/platform-feedback',
	'/admin/codemods',
	'/admin/community-reports',
	'/admin/platform-integrations',

	'/connect/oauth',
	'/connect/secrets',
	'/connect/webhook-apply',
	'/community',
	'/onboarding',
	'/reset-password',
	'/verify',
	'/login',
	'/signup',
	'/blog',
	'/docs',
	'/docs/connect',
	'/support',
	'/privacy',
	'/terms',
	'/case-studies',
	'/faq',
	'/pricing',
	'/discord',
])

export function isMigratedPathname(pathname: string) {
	const fileView =
		/^\/(?:@[^/]+\/[^/]+\/(?:files|tree\/[^/]+)|account\/packages\/[^/]+\/files|community\/[^/]+\/files)(?:\/.*)?$/.test(
			pathname,
		)
	if (!fileView && /\.(json|md)$/.test(pathname)) return false
	return (
		actionPagePaths.has(pathname) ||
		/^\/onboarding\/step-[123](?:\/[^/]+)?$/.test(pathname) ||
		migratedPaths.has(pathname) ||
		(/^\/(blog|docs)\/[^/]+$/.test(pathname) &&
			!/\.(md|json)$/.test(pathname)) ||
		/^\/@[^/]+(?:\/[^/]+)?$/.test(pathname) ||
		/^\/account\/(memories|values|jobs|workflows|activity|email|integrations|mcp-servers)\/[^/]+$/.test(
			pathname,
		) ||
		/^\/community\/[^/]+$/.test(pathname) ||
		/^\/account\/packages\/[^/]+(?:\/approve-publish)?$/.test(pathname) ||
		/^\/account\/connections\/new\/[^/]+$/.test(pathname) ||
		/^\/account\/secrets\/(?:user\/[^/]+|(?:package|session)\/[^/]+\/[^/]+)$/.test(
			pathname,
		) ||
		/^\/admin\/(users|platform-integrations)\/[^/]+$/.test(pathname) ||
		/^\/account\/integrations\/apps\/[^/]+$/.test(pathname) ||
		/^\/@[^/]+\/[^/]+\/(?:settings|approve-changes|approve-publish)$/.test(
			pathname,
		) ||
		/^\/@[^/]+\/[^/]+\/(?:files(?:\/.*)?|tree\/[^/]+(?:\/.*)?)$/.test(
			pathname,
		) ||
		/^\/(?:account\/packages|community)\/[^/]+\/files(?:\/.*)?$/.test(pathname)
	)
}

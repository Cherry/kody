import { createServerFn } from '@tanstack/react-start'

export const loadHome = createServerFn({ method: 'GET' }).handler(async () => {
	const [
		{ env },
		{ getRequest },
		{ readAuthenticatedAppUser },
		{ loadLandingHeroVideos },
		{ pickWalkthroughHosts },
		{ loadDocumentHead },
	] = await Promise.all([
		import('cloudflare:workers'),
		import('@tanstack/react-start/server'),
		import('../../src/app/authenticated-user.ts'),
		import('../../src/app/landing-hero-videos.ts'),
		import('../../universal/walkthrough-hosts.ts'),
		import('./document-head.ts'),
	])
	const [user, landingHeroVideos] = await Promise.all([
		readAuthenticatedAppUser(getRequest(), env, { prefetchFeatureFlags: true }),
		loadLandingHeroVideos({ env }),
	])
	return {
		loggedIn: user !== null,
		initialHosts: pickWalkthroughHosts(),
		landingHeroVideos,
		head: loadDocumentHead('home', '/'),
	}
})

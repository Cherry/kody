import { type Action } from 'remix/router'
import { isSecureRequest } from '#app/auth-session.ts'
import { handleFrameRequest } from '#app/frame-registry.ts'
import '#app/frame-registrations.ts'
import { loadProfileData } from '#app/profile-data.ts'
import {
	toProfileListLoaderData,
	toProfileShellLoaderData,
} from '#universal/loader-data.ts'
import { serializeLastUsedOrgCookie } from '#universal/org-last-used-cookie.ts'
import { type routes } from '#universal/routes.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import { findMemberOrganization } from './profile.tsx'

export function createProfileHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const username = params.username
			const frameResponse = await handleFrameRequest(
				request,
				env,
				new URL(request.url).pathname,
			)
			if (frameResponse) return frameResponse

			const data = await loadProfileData(env, request, username, {
				prefetchFeatureFlags: true,
			})
			if (!data) {
				const memberOrg = await findMemberOrganization(env, request, username)
				const page = await renderAppPage({
					request,
					env,
					title: memberOrg
						? memberOrg.displayName?.trim() || `@${memberOrg.slug}`
						: 'Profile unavailable',
					status: memberOrg ? 200 : 404,
					loaderData: {
						profileShell: { ok: false, unavailable: true },
					},
				})
				if (!memberOrg) return page
				// The org home is where the switcher lands from account pages, so
				// it remembers the org like the other org pages do.
				const headers = new Headers(page.headers)
				headers.append(
					'Set-Cookie',
					serializeLastUsedOrgCookie({
						slug: memberOrg.slug,
						secure: isSecureRequest(request),
					}),
				)
				return new Response(page.body, {
					status: page.status,
					statusText: page.statusText,
					headers,
				})
			}

			return renderAppPage({
				request,
				env,
				loaderData: {
					profileShell: toProfileShellLoaderData(data),
					profileList: toProfileListLoaderData(data),
				},
			})
		},
	} satisfies Action<typeof routes.profile>
}

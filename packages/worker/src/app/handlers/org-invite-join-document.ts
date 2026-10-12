import { type Action } from 'remix/router'
import { renderAppPage } from '#app/ssr-render.tsx'
import { jsonResponse } from '#worker/json-response.ts'
import { type routes } from '#universal/routes.ts'
import { loadJoinPageData, wantsJson } from './org-invite-join.ts'

export function createOrgInviteJoinHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request, params }) {
			const token =
				typeof params.token === 'string' ? params.token : String(params.token)
			const data = await loadJoinPageData({ env, request, token })
			if (wantsJson(request)) {
				return jsonResponse({ orgInviteJoin: data }, data.ok ? 200 : 400)
			}
			return renderAppPage({
				request,
				env,
				title: data.ok
					? `Join ${data.org.displayName?.trim() || data.org.slug}`
					: 'Invite link',
				status: data.ok ? 200 : 400,
				loaderData: { orgInviteJoin: data },
			})
		},
	} satisfies Action<typeof routes.orgInviteJoin>
}

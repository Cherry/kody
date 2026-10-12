import { type Action } from 'remix/router'
import { jsonResponse } from '#worker/json-response.ts'
import { readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { loadDiscordPageData } from '#app/discord-page-data.ts'
import { type routes } from '#universal/routes.ts'

export async function loadDiscordPageForRequest(input: {
	env: Env
	request: Request
	prefetchFeatureFlags?: boolean
}) {
	const user = await readAuthenticatedAppUser(input.request, input.env, {
		prefetchFeatureFlags: input.prefetchFeatureFlags,
	})
	return loadDiscordPageData({
		env: input.env,
		userId: user?.userId,
	})
}

export function createDiscordApiHandler(env: Env) {
	return {
		middleware: [],
		async handler({ request }) {
			return jsonResponse(await loadDiscordPageForRequest({ env, request }))
		},
	} satisfies Action<typeof routes.discordApi>
}

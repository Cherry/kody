import { loadAccountEmailData } from '#app/account-email-data.ts'
import { type AccountEmailLoaderData } from '#universal/loader-data.ts'
import { requireAuthenticatedPageUser } from '#app/page-auth.ts'
import { renderAppPage } from '#app/ssr-render.tsx'
import {
	buildEmailDestinationsLoaderData,
	listEmailNotificationDestinations,
} from '#worker/email/destinations.ts'
import { readPathMessageId } from './account-email.ts'

export function createAccountEmailHandler(env: Env) {
	return {
		middleware: [],
		async handler({
			request,
			params,
		}: {
			request: Request
			params?: { messageId?: string }
		}) {
			const user = await requireAuthenticatedPageUser(request, env)
			if (user instanceof Response) {
				return user
			}

			const [accountEmail, destinations] = await Promise.all([
				loadAccountEmailData({
					env,
					request,
					user,
					pathMessageId: readPathMessageId(params),
				}),
				listEmailNotificationDestinations({
					db: env.APP_DB,
					dbUserId: user.userId,
					accountEmail: user.email,
					accountEmailVerified: user.emailVerified,
				}),
			])
			return renderAppPage({
				request,
				env,
				title: 'Email inbox',
				loaderData: {
					accountEmail: accountEmail as AccountEmailLoaderData,
					accountEmailDestinations:
						buildEmailDestinationsLoaderData(destinations),
				},
			})
		},
	}
}

import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import {
	auditDatabaseFromEnv,
	getRequestIp,
	logAuditEvent,
} from '#worker/audit-log.ts'
import {
	createEmailDestinationVerification,
	emailDestinationRateLimitConfig,
	resendEmailDestinationVerification,
} from '#worker/email/destination-verification.ts'
import {
	buildEmailDestinationsLoaderData,
	EmailDestinationError,
	listEmailNotificationDestinations,
	removeEmailNotificationDestination,
	setDefaultEmailNotificationDestination,
} from '#worker/email/destinations.ts'
import { enum_, object, optional, parseSafe, string } from 'remix/data-schema'

export { emailDestinationRateLimitConfig }

const destinationMutationSchema = object({
	action: enum_(['add', 'resend', 'setDefault', 'remove'] as const),
	email: optional(string()),
	id: optional(string()),
})

const destinationListPayload = buildEmailDestinationsLoaderData

export async function mutateAccountEmailDestinations({
	request,
	env,
	user,
	body,
}: {
	request: Request
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: unknown
}) {
	const parsed = parseSafe(destinationMutationSchema, body)
	if (!parsed.success) {
		return operationResult({ ok: false, error: 'Invalid request body.' }, 400)
	}
	const action = parsed.value.action
	const email = parsed.value.email?.trim() ?? ''
	const destinationId = parsed.value.id?.trim() ?? ''
	const requestIp = getRequestIp(request) ?? undefined

	if (!user.emailVerified) {
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'email_destination',
			result: 'failure',
			email: user.email,
			ip: requestIp,
			path: new URL(request.url).pathname,
			reason: 'email_unverified',
		})
		return operationResult(
			{
				ok: false,
				error: 'Verify your account email before managing destinations.',
			},
			403,
		)
	}

	try {
		if (action === 'add' || action === 'resend') {
			if (action === 'add') {
				const result = await createEmailDestinationVerification({
					env,
					userId: user.userId,
					email,
					requestUrl: new URL(request.url),
				})
				const destinations = await listEmailNotificationDestinations({
					db: env.APP_DB,
					dbUserId: user.userId,
					accountEmail: user.email,
					accountEmailVerified: user.emailVerified,
				})
				void logAuditEvent({
					db: auditDatabaseFromEnv(env),
					category: 'account',
					action: 'email_destination',
					result: 'success',
					email: user.email,
					ip: requestIp,
					path: new URL(request.url).pathname,
					reason: `add=${result.destination.email}`,
				})
				return operationResult({
					...destinationListPayload(destinations),
					message: result.created
						? 'Verification email sent. Open the link to start using this address.'
						: 'Verification email sent again. Open the latest link to start using this address.',
				})
			}

			const destination = await resendEmailDestinationVerification({
				env,
				userId: user.userId,
				destinationId,
				requestUrl: new URL(request.url),
			})
			const destinations = await listEmailNotificationDestinations({
				db: env.APP_DB,
				dbUserId: user.userId,
				accountEmail: user.email,
				accountEmailVerified: user.emailVerified,
			})
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'account',
				action: 'email_destination',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: new URL(request.url).pathname,
				reason: `resend=${destination.email}`,
			})
			return operationResult({
				...destinationListPayload(destinations),
				message: 'Verification email sent again.',
			})
		}

		if (action === 'setDefault') {
			const destinations = await setDefaultEmailNotificationDestination({
				db: env.APP_DB,
				dbUserId: user.userId,
				destinationId,
			})
			void logAuditEvent({
				db: auditDatabaseFromEnv(env),
				category: 'account',
				action: 'email_destination',
				result: 'success',
				email: user.email,
				ip: requestIp,
				path: new URL(request.url).pathname,
				reason: `set_default=${destinationId}`,
			})
			return operationResult({
				...destinationListPayload(destinations),
				message: 'Default email destination updated.',
			})
		}

		const destinations = await removeEmailNotificationDestination({
			db: env.APP_DB,
			dbUserId: user.userId,
			destinationId,
		})
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'email_destination',
			result: 'success',
			email: user.email,
			ip: requestIp,
			path: new URL(request.url).pathname,
			reason: `remove=${destinationId}`,
		})
		return operationResult({
			...destinationListPayload(destinations),
			message: 'Email destination removed.',
		})
	} catch (error) {
		if (error instanceof EmailDestinationError) {
			if (error.code === 'rate_limited') {
				void logAuditEvent({
					db: auditDatabaseFromEnv(env),
					category: 'account',
					action: 'email_destination',
					result: 'rate_limited',
					email: user.email,
					ip: requestIp,
					path: new URL(request.url).pathname,
					reason: action,
				})
				return operationResult(
					{ ok: false, error: error.message },
					{
						status: 429,
						headers: {
							'Retry-After': String(
								emailDestinationRateLimitConfig.windowSeconds,
							),
						},
					},
				)
			}
			const status =
				error.code === 'not_found' ? 404 : error.code === 'at_cap' ? 409 : 400
			return operationResult({ ok: false, error: error.message }, status)
		}
		if (
			error instanceof Error &&
			(error.message === 'Email destination was not found.' ||
				error.message === 'That address is already verified.')
		) {
			return operationResult({ ok: false, error: error.message }, 400)
		}
		console.error('Failed to update email destinations:', error)
		void logAuditEvent({
			db: auditDatabaseFromEnv(env),
			category: 'account',
			action: 'email_destination',
			result: 'failure',
			email: user.email,
			ip: requestIp,
			path: new URL(request.url).pathname,
			reason: 'send_failed',
		})
		return operationResult(
			{
				ok: false,
				error: 'Unable to update email destinations. Please try again later.',
			},
			502,
		)
	}
}

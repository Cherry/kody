import { readAccountEmailData } from '#app/account-email-data.ts'
import { type readAuthenticatedAppUser } from '#app/authenticated-user.ts'
import { operationResult } from '#app/operation-result.ts'
import { readTrimmedStringOrEmpty } from '#app/request-body.ts'
import { authorize } from '#worker/authorization/authorize.ts'
import {
	deleteEmailMessage,
	setEmailMessageClassification,
} from '#worker/email/service.ts'
import {
	emailClassificationValues,
	type EmailClassification,
} from '#worker/email/types.ts'
import { ownerIdFromCaller } from '#worker/request-context/owner-id.ts'

export function readPathMessageId(params: unknown) {
	if (
		typeof params === 'object' &&
		params !== null &&
		'messageId' in params &&
		typeof params.messageId === 'string'
	) {
		return params.messageId
	}
	return undefined
}

function parseClassification(value: string): EmailClassification | null {
	return (emailClassificationValues as ReadonlyArray<string>).includes(value)
		? (value as EmailClassification)
		: null
}

export async function mutateAccountEmail({
	refresh,
	env,
	user,
	body,
}: {
	refresh: {
		query: string
		classification: EmailClassification | null
		page: number
		pageSize: number
	}
	env: Env
	user: NonNullable<Awaited<ReturnType<typeof readAuthenticatedAppUser>>>
	body: Record<string, unknown>
}) {
	await authorize({ env, request: user.request }, 'email:read')
	const action = readTrimmedStringOrEmpty(body, 'action')
	if (action !== 'classify' && action !== 'delete') {
		return operationResult({ ok: false, error: 'Invalid action.' }, 400)
	}

	const messageId = readTrimmedStringOrEmpty(body, 'message_id')
	if (!messageId) {
		return operationResult({ ok: false, error: 'Message id is required.' }, 400)
	}

	if (action === 'delete') {
		const deleted = await deleteEmailMessage({
			env,
			db: env.APP_DB,
			userId: ownerIdFromCaller({
				request: user.request,
				user: user.mcpUser,
			}),
			messageId,
		})
		if (!deleted) {
			return operationResult({ ok: false, error: 'Message not found.' }, 404)
		}

		return operationResult(
			await readAccountEmailData({
				env,
				...refresh,
				selectedMessageId: null,
				user,
			}),
		)
	}

	const classification = parseClassification(
		readTrimmedStringOrEmpty(body, 'classification'),
	)
	if (!classification) {
		return operationResult(
			{
				ok: false,
				error: 'Classification must be accepted or quarantined.',
			},
			400,
		)
	}

	const updated = await setEmailMessageClassification({
		env,
		db: env.APP_DB,
		userId: ownerIdFromCaller({
			request: user.request,
			user: user.mcpUser,
		}),
		messageId,
		classification,
		classificationReason:
			classification === 'quarantined' ? 'Reclassified by user.' : null,
	})
	if (!updated) {
		return operationResult(
			{
				ok: false,
				error: 'Message not found or is not an inbound message.',
			},
			404,
		)
	}

	return operationResult(
		await readAccountEmailData({
			env,
			...refresh,
			selectedMessageId: messageId,
			user,
		}),
	)
}

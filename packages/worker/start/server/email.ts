import { createServerFn } from '@tanstack/react-start'
import { loadCollection } from './account-collections.ts'
import {
	emailListHref,
	emailSearch,
	type EmailListInput,
} from '../pages/email-resources.ts'
import { readJsonRecord } from './json-value.ts'

function validateList(input: EmailListInput): EmailListInput {
	if (
		!input ||
		(input.org !== null &&
			(typeof input.org !== 'string' ||
				!input.org ||
				/[/\\?#]/.test(input.org)))
	)
		throw new Error('Invalid inbox organization')
	const search = emailSearch({
		q: input.query,
		classification: input.classification,
		page: input.page,
		pageSize: input.pageSize,
	})
	return {
		org: input.org,
		query: search.q,
		classification: search.classification,
		page: search.page,
		pageSize: search.pageSize,
	}
}
export const loadEmailList = createServerFn({ method: 'GET' })
	.validator(validateList)
	.handler(async ({ data }) => {
		const { bindings, request, user } = await loadCollection(
			emailListHref(data),
		)
		const { loadAccountEmailData } =
			await import('../../src/app/account-email-data.ts')
		// The list request deliberately has neither a detail path nor selection.
		const { selectedMessage: _selectedMessage, ...list } =
			await loadAccountEmailData({ env: bindings, request, user })
		return list
	})
export const loadEmailDetail = createServerFn({ method: 'GET' })
	.validator((input: { org: string | null; messageId: string }) => {
		validateList({
			...input,
			query: '',
			classification: null,
			page: 1,
			pageSize: 25,
		})
		if (typeof input.messageId !== 'string' || !input.messageId.trim())
			throw new Error('Invalid email message')
		return input
	})
	.handler(async ({ data }) => {
		const { bindings, user } = await loadCollection(
			emailListHref({
				org: data.org,
				query: '',
				classification: null,
				page: 1,
				pageSize: 25,
			}),
		)
		const { loadAccountEmailDetail } =
			await import('../../src/app/account-email-data.ts')
		const detail = await loadAccountEmailDetail({
			env: bindings,
			user,
			messageId: data.messageId,
		})
		return detail
			? {
					...detail,
					headers: detail.headers ? readJsonRecord(detail.headers) : null,
				}
			: null
	})
export const loadEmailDestinations = createServerFn({ method: 'GET' }).handler(
	async () => {
		// Notification destinations belong to the signed-in actor, not an org.
		const { bindings, user } = await loadCollection('/account/email')
		const {
			listEmailNotificationDestinations,
			buildEmailDestinationsLoaderData,
		} = await import('../../src/email/destinations.ts')
		return buildEmailDestinationsLoaderData(
			await listEmailNotificationDestinations({
				db: bindings.APP_DB,
				dbUserId: user.userId,
				accountEmail: user.email,
				accountEmailVerified: user.emailVerified,
			}),
		)
	},
)

/** @jsxImportSource @emotion/react */
import { orgAccountApiReferrer } from '#client/org-account-api.ts'
import { relocateAccountHref } from '#universal/org-pages.ts'
import { pageQueryOrg } from '../page-query-scope.ts'
import { usePageInvalidation } from '../page-invalidation.ts'
import { formatNullableTimestamp } from '../components/local-timestamp.tsx'
import { useState } from 'react'
import {
	useMutation,
	useMutationState,
	useQueryClient,
} from '@tanstack/react-query'
import { toast } from '#client/toast.ts'
import {
	emailMutationOptions,
	type EmailAction,
} from './account-email-query.ts'
import { useRouteContext, useRouter } from '@tanstack/react-router'
import { useShellData } from '../routes/__root.tsx'
import { acceptedEmailVerificationDelivery } from '#universal/email-verification-delivery.ts'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { useAccountEmailDestinations } from './account-email-destinations-client.ts'
import { renderAccountEmailDestinationsPanel } from './account-email-destinations-panel.tsx'
import {
	AccountManagementMessage,
	AccountManagementShell,
	AccountPageHeader,
} from './account-management-components.tsx'
import {
	renderEmailVerificationPrompt,
	requestResendVerification,
} from './email-verification-prompt.tsx'
import {
	RecordTable,
	RecordTableSearch,
	RecordTableSelect,
	recordStampCss,
} from './record-table.tsx'
import { colors, spacing, typography } from '#universal/styles/tokens.ts'
import { getGhostButtonCss } from '#universal/styles/style-primitives.ts'
import {
	type AccountEmailDestinationsLoaderData,
	type AccountEmailLoaderData,
	type AccountEmailMessageDetail,
} from '#universal/loader-data.ts'
import { renderAccountEmailDetail } from './account-email-detail.tsx'
import {
	type ClassificationFilter,
	buildEmailApiRequestUrl,
	clampedCellCss,
	directionLabel,
	emailRoute,
	messageDate,
	quarantinedBadgeCss,
	readClassificationFilter,
	readPage,
	readSearchQuery,
	statusLabel,
	subjectCellCss,
	truncatedTextCss,
} from './account-email-shared.ts'

export function AccountEmailPage({
	payload,
	destinations,
	currentHref,
}: {
	payload: AccountEmailLoaderData
	destinations: AccountEmailDestinationsLoaderData
	currentHref: string
}) {
	const data = payload
	const [notice, setNotice] = useState<{ href: string; text: string } | null>(
		null,
	)
	const message = notice?.href === currentHref ? notice.text : null
	const setMessage = (text: string | null) =>
		setNotice(text ? { href: currentHref, text } : null)
	const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null)
	const deleteArmed =
		deleteArmedId !== null && deleteArmedId === data.selectedMessage?.id
	const [resendStatus, setResendStatus] = useState<'idle' | 'sending'>('idle')
	const [resendMessage, setResendMessage] = useState<string | null>(null)
	const [resendTone, setResendTone] = useState<'error' | 'info'>('info')
	const [resendAccepted, setResendAccepted] = useState(false)
	const accountEmailDestinations = useAccountEmailDestinations(destinations)
	const { session } = useShellData()
	const invalidatePages = usePageInvalidation(mutationResources, {
		refreshShell: true,
	})
	const router = useRouter()
	const navigate = (href: string) =>
		void router.navigate({
			to: relocateAccountHref(href, currentHref),
			resetScroll: false,
		})
	const replaceLocation = (href: string) =>
		void router.navigate({
			to: relocateAccountHref(href, currentHref),
			replace: true,
			resetScroll: false,
		})

	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })

	function getCurrentHref() {
		return currentHref
	}

	function getCurrentSearch() {
		return new URL(getCurrentHref(), 'http://localhost').search
	}

	function buildHrefWithUpdatedSearch(search: string) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		if (search) nextUrl.searchParams.set('q', search)
		else nextUrl.searchParams.delete('q')
		nextUrl.searchParams.delete('page')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function buildHrefWithPage(page: number) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		if (page > 1) nextUrl.searchParams.set('page', String(page))
		else nextUrl.searchParams.delete('page')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	function buildHrefWithClassification(filter: ClassificationFilter) {
		const nextUrl = new URL(getCurrentHref(), 'http://localhost')
		if (filter === 'all') nextUrl.searchParams.delete('classification')
		else nextUrl.searchParams.set('classification', filter)
		nextUrl.searchParams.delete('page')
		return `${nextUrl.pathname}${nextUrl.search}`
	}

	async function handleResendVerification() {
		setResendStatus('sending')
		setResendMessage(null)
		setResendTone('info')

		try {
			const result = await requestResendVerification()
			if (result.ok) void invalidatePages()
			if (!result.ok && result.unauthorized) {
				window.location.assign('/login')
				return
			}
			setResendTone(result.ok ? 'info' : 'error')
			setResendMessage(result.message)
			if (result.ok) {
				setResendAccepted(true)
			}
		} catch {
			setResendTone('error')
			setResendMessage('Unable to send the verification email.')
		} finally {
			setResendStatus('idle')
		}
	}

	const queryClient = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const mutationKey = ['email', actorKey, pageQueryOrg(currentHref)] as const
	const pendingActions = useMutationState({
		filters: { mutationKey, status: 'pending' },
		select: (mutation) => (mutation.state.variables as EmailAction).action,
	})
	const classifyState = pendingActions.includes('classify') ? 'saving' : 'idle'
	const deleteState = pendingActions.includes('delete') ? 'deleting' : 'idle'
	const emailMutation = useMutation(
		emailMutationOptions(
			queryClient,
			actorKey,
			async (action) => {
				const response = await fetch(buildEmailApiRequestUrl(action.href), {
					method: 'POST',
					referrer: orgAccountApiReferrer(action.href),
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({
						action: action.action,
						message_id: action.messageId,
						...(action.action === 'classify'
							? { classification: action.classification }
							: {}),
					}),
				})
				if (response.status === 401) window.location.assign('/login')
				const accepted = await readJson<
					AccountEmailLoaderData & { error?: string }
				>(response)
				if (!response.ok || !accepted?.ok)
					throw new Error(
						accepted?.error ||
							(action.action === 'delete'
								? 'Unable to delete message.'
								: 'Unable to update message classification.'),
					)
				return accepted
			},
			(error) => toast.error(error.message),
			currentHref,
		),
	)

	function deleteSelectedMessage() {
		const selected = data.selectedMessage
		if (!selected || queryClient.isMutating({ mutationKey })) return
		setMessage(null)
		const listHref = emailRoute.buildListHref(getCurrentSearch(), currentHref)
		emailMutation.mutate(
			{ action: 'delete', messageId: selected.id, href: currentHref },
			{
				onSuccess: () => {
					if (router.state.location.href !== currentHref) return
					setDeleteArmedId(null)
					setMessage('Message deleted.')
					navigate(listHref)
				},
				onError: () => setDeleteArmedId(null),
			},
		)
	}

	function classifySelectedMessage(classification: 'accepted' | 'quarantined') {
		const selected = data.selectedMessage
		if (
			!selected ||
			selected.direction !== 'inbound' ||
			queryClient.isMutating({ mutationKey })
		)
			return
		setMessage(null)
		emailMutation.mutate(
			{
				action: 'classify',
				messageId: selected.id,
				classification,
				href: currentHref,
			},
			{
				onSuccess: () => {
					if (router.state.location.href !== currentHref) return
					setMessage(
						classification === 'quarantined'
							? 'Marked as spam.'
							: 'Marked as not spam.',
					)
				},
			},
		)
	}

	const status = 'ready'
	const selectedMessageId = emailRoute.getSelection(currentHref).selectedId
	const selectedMessage: AccountEmailMessageDetail | null =
		data?.selectedMessage ?? null
	const totalPages = data
		? Math.max(1, Math.ceil(data.total / data.pageSize))
		: 1
	const currentPage = data?.page ?? readPage(currentHref)
	const searchQuery = data?.query ?? readSearchQuery(currentHref)
	const classificationFilter =
		data?.classification === 'quarantined'
			? 'quarantined'
			: readClassificationFilter(currentHref)
	const showUnverified = data != null && !data.emailVerified

	return (
		<AccountManagementShell maxWidth="min(100%, 92rem)" busy={false}>
			<AccountPageHeader
				title="Email inbox"
				description="Browse inbound and outbound messages for your platform email address. Compose and reply through Kody agents. Manage the addresses emailSend may use here."
				currentHref={currentHref}
			/>

			{message ||
			(data.emailVerified && selectedMessageId && !selectedMessage) ? (
				<AccountManagementMessage tone={message ? 'info' : 'error'}>
					{message ?? 'Message not found.'}
				</AccountManagementMessage>
			) : null}
			{data && !showUnverified ? (
				<>
					{data.usage || data.inboxAddress ? (
						<div
							css={{
								display: 'grid',
								gap: spacing.sm,
								marginBottom: spacing.md,
							}}
						>
							{data.inboxAddress ? (
								<p css={{ margin: 0, color: colors.text }}>
									Inbox address:{' '}
									<code css={{ overflowWrap: 'anywhere' }}>
										{data.inboxAddress}
									</code>
								</p>
							) : null}
							{data.usage ? (
								<p
									css={{
										margin: 0,
										color: colors.textMuted,
										fontSize: typography.fontSize.sm,
									}}
								>
									Plan {data.usage.plan}: {data.usage.stored_messages.count}/
									{data.usage.stored_messages.limit} stored ·{' '}
									{data.usage.receives_today.count}/
									{data.usage.receives_today.limit} received today ·{' '}
									{data.usage.sends_today.count}/{data.usage.sends_today.limit}{' '}
									sent today
								</p>
							) : null}
						</div>
					) : null}
					{destinations
						? renderAccountEmailDestinationsPanel({
								destinations: accountEmailDestinations.destinations,
								additionalRemaining:
									accountEmailDestinations.additionalRemaining,
								additionalLimit: accountEmailDestinations.additionalLimit,
								draftEmail: accountEmailDestinations.draftEmail,
								status: accountEmailDestinations.status,
								message: accountEmailDestinations.message,
								tone: accountEmailDestinations.tone,
								pendingId: accountEmailDestinations.pendingId,
								onDraftEmailInput: accountEmailDestinations.updateDraftEmail,
								onAddSubmit: (event) => {
									void accountEmailDestinations.handleAddSubmit(event)
								},
								onResend: (id) => {
									void accountEmailDestinations.resend(id)
								},
								onSetDefault: (id) => {
									void accountEmailDestinations.setDefault(id)
								},
								onRemove: (id) => {
									void accountEmailDestinations.remove(id)
								},
							})
						: null}
					<RecordTable
						mode="expand"
						busy={false}
						ariaLabel="Inbox messages"
						selectedId={selectedMessageId}
						countLabel={
							status === 'ready'
								? `${data.total} ${data.total === 1 ? 'message' : 'messages'}`
								: undefined
						}
						emptyLabel={
							searchQuery || classificationFilter !== 'all'
								? 'No messages match the current filters.'
								: 'No messages in your inbox yet.'
						}
						toolbar={
							<>
								<RecordTableSearch
									label="Search messages"
									placeholder="Search subject or from"
									value={searchQuery}
									onInput={(value) => {
										replaceLocation(buildHrefWithUpdatedSearch(value))
									}}
								/>
								<RecordTableSelect
									label="Filter messages by classification"
									value={classificationFilter}
									onChange={(value) => {
										replaceLocation(
											buildHrefWithClassification(
												value === 'quarantined' ? 'quarantined' : 'all',
											),
										)
									}}
								>
									<option value="all">All messages</option>
									<option value="quarantined">Quarantined</option>
								</RecordTableSelect>
							</>
						}
						columns={[
							{ key: 'subject', label: 'Subject', primary: true },
							{ key: 'from', label: 'From', drop: 1 },
							{ key: 'direction', label: 'Direction', drop: 3 },
							{ key: 'status', label: 'Status', drop: 2 },
							{ key: 'date', label: 'Date' },
						]}
						rows={data.messages.map((emailMessage) => ({
							id: emailMessage.id,
							href: emailRoute.buildDetailHref(
								emailMessage.id,
								getCurrentSearch(),
								currentHref,
							),
							cells: {
								subject: (
									<span css={subjectCellCss}>
										<span css={truncatedTextCss}>
											{emailMessage.subject || '(no subject)'}
										</span>
										{emailMessage.classification === 'quarantined' ? (
											<span
												title={
													emailMessage.classification_reason ?? 'Quarantined'
												}
												css={quarantinedBadgeCss}
											>
												Quarantined
											</span>
										) : null}
									</span>
								),
								from: (
									<span css={clampedCellCss}>
										{emailMessage.from_address ??
											emailMessage.envelope_from ??
											'Unknown sender'}
									</span>
								),
								direction: directionLabel(emailMessage.direction),
								status: statusLabel(emailMessage),
								date: (
									<span css={recordStampCss}>
										{formatNullableTimestamp(
											messageDate(emailMessage),
											'Unknown',
										)}
									</span>
								),
							},
						}))}
						footer={
							totalPages > 1 ? (
								<div
									css={{
										display: 'flex',
										gap: spacing.sm,
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<button
										type="button"
										disabled={currentPage <= 1}
										onClick={() => {
											replaceLocation(buildHrefWithPage(currentPage - 1))
										}}
										css={secondaryButtonCss}
									>
										Previous
									</button>
									<p
										css={{
											margin: 0,
											color: colors.textMuted,
											fontSize: typography.fontSize.xs,
										}}
									>
										Page {currentPage} of {totalPages}
									</p>
									<button
										type="button"
										disabled={currentPage >= totalPages}
										onClick={() => {
											replaceLocation(buildHrefWithPage(currentPage + 1))
										}}
										css={secondaryButtonCss}
									>
										Next
									</button>
								</div>
							) : null
						}
						record={
							selectedMessage
								? renderAccountEmailDetail({
										selectedMessage,
										classifyState,
										deleteState,
										deleteArmed,
										onDeleteArm: () => setDeleteArmedId(selectedMessage.id),
										onDeleteReset: () => setDeleteArmedId(null),
										onClassify: (classification) => {
											void classifySelectedMessage(classification)
										},
										onDelete: () => {
											void deleteSelectedMessage()
										},
									})
								: null
						}
					/>
				</>
			) : null}
			{data && showUnverified ? (
				<>
					{data.inboxAddress ? (
						<p css={{ margin: 0 }}>
							Your inbox address will be <code>{data.inboxAddress}</code> after
							verification.
						</p>
					) : null}
					{renderEmailVerificationPrompt({
						email: data.email,
						description:
							'Verify your account email to browse stored messages. MCP access and email features stay locked until this account email is verified.',
						delivery: resendAccepted
							? acceptedEmailVerificationDelivery()
							: (session?.emailVerificationDelivery ?? null),
						resendStatus,
						resendMessage,
						resendTone,
						onResend: () => {
							void handleResendVerification()
						},
						secondaryHref: '/pending-verification',
						secondaryLabel: 'Verification page',
					})}
				</>
			) : null}
		</AccountManagementShell>
	)
}

const mutationResources = ['loadEmailPage', 'loadAccountPage'] as const

import { usePageInvalidation } from '../page-invalidation.ts'
import { useState, type FormEvent } from 'react'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { type EmailNotificationDestination } from '#universal/email-destinations.ts'
import { type AccountEmailDestinationsLoaderData } from '#universal/loader-data.ts'

const destinationsApiPath = '/account/email-destinations.json'

export function useAccountEmailDestinations(
	initialPayload: AccountEmailDestinationsLoaderData,
) {
	const invalidatePages = usePageInvalidation(mutationResources)
	const [destinations, setDestinations] = useState<
		Array<EmailNotificationDestination>
	>(initialPayload.destinations)
	const [additionalLimit, setAdditionalLimit] = useState(
		initialPayload.additionalLimit,
	)
	const [additionalRemaining, setAdditionalRemaining] = useState(
		initialPayload.additionalRemaining,
	)
	const [draftEmail, setDraftEmail] = useState('')
	const [status, setStatus] = useState<'idle' | 'sending'>('idle')
	const [message, setMessage] = useState<string | null>(null)
	const [tone, setTone] = useState<'error' | 'info'>('info')
	const [pendingId, setPendingId] = useState<string | null>(null)

	const [lastPayload, setLastPayload] = useState(initialPayload)
	if (lastPayload !== initialPayload && status === 'idle') {
		setLastPayload(initialPayload)
		applyPayload(initialPayload)
	}

	function applyPayload(payload: AccountEmailDestinationsLoaderData) {
		setDestinations(payload.destinations)
		setAdditionalLimit(payload.additionalLimit)
		setAdditionalRemaining(payload.additionalRemaining)
	}

	function updateDraftEmail(event: FormEvent<HTMLInputElement>) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		setDraftEmail(event.currentTarget.value)
	}

	async function mutate(body: Record<string, string>) {
		if (status !== 'idle') return
		setStatus('sending')
		setPendingId(body.id ?? null)
		setMessage(null)
		try {
			const response = await fetch(destinationsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(body),
			})
			const payload = await readJson<
				AccountEmailDestinationsLoaderData & { error?: string }
			>(response)
			if (!response.ok || !payload?.ok) {
				setMessage(payload?.error ?? 'Unable to update email destinations.')
				setTone('error')
				return
			}
			applyPayload(payload)
			void invalidatePages()
			if (body.action === 'add') setDraftEmail('')
			setMessage(payload.message ?? 'Email destinations updated.')
			setTone('info')
		} catch {
			setMessage('Unable to update email destinations.')
			setTone('error')
		} finally {
			setStatus('idle')
			setPendingId(null)
		}
	}

	async function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		await mutate({ action: 'add', email: draftEmail })
	}

	async function resend(id: string) {
		await mutate({ action: 'resend', id })
	}

	async function setDefault(id: string) {
		await mutate({ action: 'setDefault', id })
	}

	async function remove(id: string) {
		await mutate({ action: 'remove', id })
	}

	return {
		get destinations() {
			return destinations
		},
		get additionalLimit() {
			return additionalLimit
		},
		get additionalRemaining() {
			return additionalRemaining
		},
		get draftEmail() {
			return draftEmail
		},
		get status() {
			return status
		},
		get message() {
			return message
		},
		get tone() {
			return tone
		},
		get pendingId() {
			return pendingId
		},
		applyPayload,
		updateDraftEmail,
		handleAddSubmit,
		resend,
		setDefault,
		remove,
	}
}

const mutationResources = ['loadEmailPage'] as const

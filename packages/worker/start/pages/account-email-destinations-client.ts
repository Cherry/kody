import { useState, type FormEvent } from 'react'
import {
	useMutation,
	useMutationState,
	useQueryClient,
} from '@tanstack/react-query'
import { readJson } from '#client/routes/account-approval-shared.ts'
import { type AccountEmailDestinationsLoaderData } from '#universal/loader-data.ts'
import { emailKeys } from './email-resources.ts'

const destinationsApiPath = '/account/email-destinations.json'

export function useAccountEmailDestinations(
	payload: AccountEmailDestinationsLoaderData,
	actorKey: string | null,
) {
	const client = useQueryClient()
	const [draftEmail, setDraftEmail] = useState('')
	const [message, setMessage] = useState<string | null>(null)
	const [tone, setTone] = useState<'error' | 'info'>('info')
	const pendingWrites = useMutationState({
		filters: {
			mutationKey: ['email-destination-write', actorKey],
			status: 'pending',
		},
		select: (entry) => entry.state.variables as Record<string, string>,
	})
	const busy = pendingWrites.length > 0
	const mutation = useMutation({
		mutationKey: ['email-destination-write', actorKey],
		mutationFn: async (body: Record<string, string>) => {
			const response = await fetch(destinationsApiPath, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(body),
			})
			const accepted = await readJson<
				AccountEmailDestinationsLoaderData & { error?: string }
			>(response)
			if (!response.ok || !accepted?.ok)
				throw new Error(
					accepted?.error ?? 'Unable to update email destinations.',
				)
			return accepted
		},
		onSuccess: async (accepted) => {
			await client.cancelQueries({
				queryKey: emailKeys.destinations(actorKey),
				exact: true,
			})
			client.setQueryData(emailKeys.destinations(actorKey), accepted)
		},
		// A failed response does not prove that the write failed to commit.
		onSettled: () =>
			client.invalidateQueries({
				queryKey: emailKeys.destinations(actorKey),
				exact: true,
			}),
	})
	function updateDraftEmail(event: FormEvent<HTMLInputElement>) {
		setDraftEmail(event.currentTarget.value)
	}
	function mutate(body: Record<string, string>) {
		if (busy) return
		setMessage(null)
		mutation.mutate(body, {
			onSuccess: (accepted) => {
				if (body.action === 'add') setDraftEmail('')
				setMessage(accepted.message ?? 'Email destinations updated.')
				setTone('info')
			},
			onError: (error) => {
				setMessage(error.message)
				setTone('error')
			},
		})
	}
	function handleAddSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		mutate({ action: 'add', email: draftEmail })
	}
	return {
		destinations: payload.destinations,
		additionalLimit: payload.additionalLimit,
		additionalRemaining: payload.additionalRemaining,
		draftEmail,
		status: busy ? ('sending' as const) : ('idle' as const),
		message,
		tone,
		pendingId: pendingWrites[0]?.id ?? null,
		updateDraftEmail,
		handleAddSubmit,
		resend: (id: string) => mutate({ action: 'resend', id }),
		setDefault: (id: string) => mutate({ action: 'setDefault', id }),
		remove: (id: string) => mutate({ action: 'remove', id }),
	}
}

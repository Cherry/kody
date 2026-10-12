import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
const read = vi.hoisted(() => vi.fn(async () => ({ revision: 1 })))
vi.mock('#start/server/shell', () => ({ loadShell: read }))
import {
	requiresSessionVerification,
	shellQuery,
	shellSearch,
	ensureShellQuery,
	invalidateShellQueries,
} from './shell-query.ts'
const clients: QueryClient[] = []
afterEach(() => {
	clients.splice(0).forEach((client) => client.clear())
	read.mockClear()
})
it('shares warm shell presentation across ordinary route/search changes', async () => {
	const client = new QueryClient()
	clients.push(client)
	await client.ensureQueryData(shellQuery('a', '?q=one&og=test'))
	await client.ensureQueryData(shellQuery('a', '?q=two'))
	expect(read).toHaveBeenCalledTimes(1)
	await client.ensureQueryData(shellQuery('b', ''))
	expect(read).toHaveBeenCalledTimes(2)
	await invalidateShellQueries(client, 'a')
	expect(
		client.getQueryState(shellQuery('a', '').queryKey)?.isInvalidated,
	).toBe(true)
	expect(
		client.getQueryState(shellQuery('b', '').queryKey)?.isInvalidated,
	).toBe(false)
})
it('retains preview and video dependencies in a stable key', () => {
	expect(
		shellSearch(
			'?q=x&youtubeId=video&siteBannerPreview=one&siteBannerLook=dark&og=x',
		),
	).toBe('?siteBannerLook=dark&siteBannerPreview=one&youtubeId=video')
	expect(shellQuery('a', '?youtubeId=first').queryKey).not.toEqual(
		shellQuery('a', '?youtubeId=second').queryKey,
	)
})
it('only skips foreground identity checks for known public content', () => {
	for (const path of [
		'/',
		'/pricing',
		'/support',
		'/blog/post',
		'/docs/connect',
		'/docs/what-is-kody',
		'/docs/integration-backed-app-happy-path',
	])
		expect(requiresSessionVerification(path)).toBe(false)
	for (const path of [
		'/discord',
		'/docs/admin-events',
		'/docs/admin%2Devents',
		'/docs/unknown',
		'/docs/%invalid',
		'/account',
		'/account/jobs',
		'/admin/users',
		'/@jane',
		'/@jane/private',
		'/community',
		'/connect/oauth',
		'/verify-email',
		'/account/billing/success',
		'/unknown',
	])
		expect(requiresSessionVerification(path)).toBe(true)
})

it('preview revisits reauthorize instead of reusing a same-actor snapshot', async () => {
	const client = new QueryClient()
	clients.push(client)
	await ensureShellQuery(client, 'a', '?siteBannerPreview=draft')
	await ensureShellQuery(client, 'a', '?siteBannerPreview=draft')
	expect(read).toHaveBeenCalledTimes(2)
})

it('a late preview response cannot replace a newer permission check', async () => {
	const client = new QueryClient()
	clients.push(client)
	await ensureShellQuery(client, 'a', '?siteBannerLook=card')
	let release!: (value: { revision: number }) => void
	const held = new Promise<{ revision: number }>((resolve) => {
		release = resolve
	})
	read.mockImplementationOnce(() => held)
	const options = shellQuery('a', '?siteBannerLook=card')
	const oldRead = client.refetchQueries({
		queryKey: options.queryKey,
		exact: true,
	})
	read.mockResolvedValueOnce({ revision: 2 })
	await ensureShellQuery(client, 'a', '?siteBannerLook=card')
	release({ revision: 0 })
	await oldRead
	expect(client.getQueryData(options.queryKey)).toMatchObject({ revision: 2 })
})

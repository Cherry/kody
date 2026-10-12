import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
const read = vi.hoisted(() => vi.fn(async () => ({ revision: 1 })))
vi.mock('#start/server/shell', () => ({ loadShell: read }))
import {
	requiresSessionVerification,
	shellQuery,
	shellSearch,
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
it('retains video dependencies in a stable key', () => {
	expect(shellSearch('?q=x&youtubeId=video&og=x')).toBe('?youtubeId=video')
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

import { afterEach, expect, test, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { orgPeopleMutationOptions } from './pages/org-people-mutation.ts'

afterEach(() => vi.unstubAllGlobals())

test.each(['accepted', 'lost response'])(
	'organization people writes reconcile their captured scope after unmount: %s',
	async (outcome) => {
		const client = new QueryClient()
		const key = ['page', 'actor-a', 'loadOrgMembers', { slug: 'team-a' }]
		const teamKey = ['page', 'actor-a', 'loadOrgTeams', { slug: 'team-a' }]
		const otherOrg = ['page', 'actor-a', 'loadOrgMembers', { slug: 'team-b' }]
		const otherActor = ['page', 'actor-b', 'loadOrgMembers', { slug: 'team-a' }]
		const affected = [
			key,
			teamKey,
			['page', 'actor-a', 'loadJobsPage', '/@team-a/-/jobs'],
			[
				'page',
				'actor-a',
				'loadPackage',
				{ username: 'team-a', kodyId: 'example' },
			],
			['shell', 'actor-a', ''],
			['page', 'actor-a', 'loadOrganizations', undefined],
		]
		const unaffected = [
			otherOrg,
			otherActor,
			['page', 'actor-a', 'loadJobsPage', '/@team-b/-/jobs'],
			['shell', 'actor-b', ''],
		]
		for (const entry of [...affected, ...unaffected])
			client.setQueryData(entry, { members: ['previous-member'] })
		let resolve!: (response: Response) => void
		let reject!: (error: Error) => void
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((yes, no) => {
						resolve = yes
						reject = no
					}),
			),
		)
		const observer = new MutationObserver(
			client,
			orgPeopleMutationOptions(client, key),
		)
		const unsubscribe = observer.subscribe(() => {})
		const write = observer.mutate({
			href: '/@team-a/-/members',
			body: { action: 'remove', memberId: 'previous-member' },
		})
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())
		unsubscribe()
		if (outcome === 'accepted') {
			resolve(Response.json({ ok: true }))
			await write
		} else {
			reject(new Error('Response lost after write'))
			await expect(write).rejects.toThrow('Response lost after write')
		}
		for (const entry of affected)
			expect(client.getQueryState(entry)?.isInvalidated).toBe(true)
		for (const entry of unaffected)
			expect(client.getQueryState(entry)?.isInvalidated).toBe(false)
		client.clear()
	},
)

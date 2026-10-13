import { jsx } from 'react/jsx-runtime'
import { expect, test } from 'vitest'
import { renderStartPage } from './test-support/render-start-page.ts'
import { AccountPackageApproveCapabilitiesRoute } from './pages/account-package-approve-capabilities.tsx'
import { type AccountPackageApproveCapabilitiesLoaderData } from '#universal/loader-data.ts'
const payload: AccountPackageApproveCapabilitiesLoaderData = {
	ok: true,
	pendingApprovals: [],
	email: 'owner@example.com',
	package: {
		id: 'pkg',
		name: 'Example',
		kodyId: 'example',
		sourceId: 'source',
		hasApp: true,
		isInternetVisible: false,
	},
	publishedCommit: 'abc123',
	fingerprint: 'reviewed-fingerprint',
	entries: [
		{
			kind: 'credential',
			credentialId: 'credential-id',
			name: 'Email credential',
			credentialKind: 'oauth',
			hosts: ['api.example.com'],
			via: ['root', 'mail'],
		},
		{ kind: 'storage', storageId: 'storage-id', hosts: [], via: ['root'] },
	],
	fingerprintMatchesApproval: false,
	latestApprovedAt: null,
	settingsHref: '/@owner/example/settings',
	packageHref: '/@owner/example',
	approveHref: '/@owner/example/approve-capabilities',
}
test('native capability review displays reachable credentials, hosts, paths and pinned fingerprint', async () => {
	const html = await renderStartPage(
		jsx(AccountPackageApproveCapabilitiesRoute, {
			payload,
			username: 'owner',
			kodyId: 'example',
		}),
		payload.approveHref,
	)
	for (const value of [
		'reviewed-fingerprint',
		'Email credential',
		'api.example.com',
		'credential-id',
		'storage-id',
		'Approve capability set',
		'How it is reached',
	])
		expect(html).toContain(value)
	expect(html).toContain('href="/@owner/example/settings"')
})
test('unpublished native capability review cannot approve and explains why', async () => {
	const html = await renderStartPage(
		jsx(AccountPackageApproveCapabilitiesRoute, {
			payload: { ...payload, publishedCommit: null },
			username: 'owner',
			kodyId: 'example',
		}),
		payload.approveHref,
	)
	expect(html).toContain('Publish this package before approving')
	expect(html).toMatch(
		/<button[^>]*disabled[^>]*data-testid="package-approve-capabilities"/,
	)
})

test('pending review offers separate credential and public-serving approvals', async () => {
	const html = await renderStartPage(
		jsx(AccountPackageApproveCapabilitiesRoute, {
			payload: {
				...payload,
				pendingApprovals: [
					{
						id: 'request-1',
						reason: 'credential_needs_changed',
						reasonLabel: 'Credential access changed',
						pendingCommit: 'paused-commit',
						createdAt: '2026-10-13T00:00:00Z',
						changes: ['Add mail credential for api.example.com'],
						approveAction: 'approve-credential-needs',
					},
					{
						id: 'request-2',
						reason: 'went_public',
						reasonLabel: 'Package became public',
						pendingCommit: 'public-commit',
						createdAt: '2026-10-13T00:00:00Z',
						changes: [],
						approveAction: 'approve-went-public',
					},
				],
			},
			username: 'owner',
			kodyId: 'example',
		}),
		payload.approveHref,
	)
	for (const value of [
		'Approve package changes',
		'previously published version keeps running',
		'Credential access changed',
		'paused-commit',
		'Add mail credential for api.example.com',
		'Package became public',
		'public-commit',
		'Internet-visible serving',
	])
		expect(html).toContain(value)
	expect(
		html.match(/data-testid="package-pending-approval-approve"/g),
	).toHaveLength(2)
	expect(html).toContain('Approve and publish')
})

test('public serving approval is distinct from approving the capability set', async () => {
	const html = await renderStartPage(
		jsx(AccountPackageApproveCapabilitiesRoute, {
			payload: {
				...payload,
				pendingApprovals: [
					{
						id: 'public-request',
						reason: 'went_public',
						reasonLabel: 'Package became public',
						pendingCommit: 'published-commit',
						createdAt: '2026-10-13T00:00:00Z',
						changes: [],
						approveAction: 'approve-went-public',
					},
				],
			},
			username: 'owner',
			kodyId: 'example',
		}),
		payload.approveHref,
	)
	expect(html).toContain(
		'Internet-visible serving stays off until you approve.',
	)
	expect(html).toContain('Published commit')
	expect(html).toContain('Approve and make internet-visible')
	expect(html).toContain('Approve capability set')
})

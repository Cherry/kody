import { jsx } from 'react/jsx-runtime'
import { expect, test } from 'vitest'
import { renderStartPage } from './test-support/render-start-page.ts'
import { AccountPackageApproveCapabilitiesRoute } from './pages/account-package-approve-capabilities.tsx'
import { type AccountPackageApproveCapabilitiesLoaderData } from '#universal/loader-data.ts'
const payload: AccountPackageApproveCapabilitiesLoaderData = {
	ok: true,
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
		'Approve and make internet-visible',
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

import { createElement } from 'react'
import { expect, test } from 'vitest'
import { ApprovalBundleRoute } from './pages/approval-bundle.tsx'
import { renderStartPage } from './test-support/render-start-page.ts'
import {
	type ApprovalBundleLoaderData,
	type ApprovalItemView,
} from '#universal/approval-bundles.ts'

const item: ApprovalItemView = {
	key: 'publish:request-1',
	type: 'publish',
	title: 'Publish changed credentials',
	summary: 'Publish the reviewed changes.',
	package: {
		id: 'package-1',
		name: '@acme/tool',
		kodyId: 'tool',
		href: '/@acme/tool',
	},
	status: 'pending',
	statusMessage: null,
	canApprove: true,
	canDeny: true,
	fingerprint: 'reviewed-fingerprint',
	grants: [],
	reviewHref: '/@acme/tool/approve-publish',
	decision: null,
}
function render(payload: ApprovalBundleLoaderData) {
	return renderStartPage(
		createElement(ApprovalBundleRoute, {
			payload,
			orgSlug: 'acme',
			bundleId: 'bundle-1',
			queryKey: [
				'page',
				null,
				'loadApprovalBundle',
				{ orgSlug: 'acme', bundleId: 'bundle-1' },
			],
		}),
		'/@acme/-/approvals/bundle-1',
	)
}
function data(items: ApprovalItemView[]): ApprovalBundleLoaderData {
	return {
		ok: true,
		view: {
			ok: true,
			bundle: {
				id: 'bundle-1',
				orgSlug: 'acme',
				createdAt: '2026-10-14',
				expiresAt: '2026-11-14',
				note: '<script>untrusted note</script>',
				createdVia: 'CLI',
			},
			groups: [{ package: item.package, items }],
		},
	}
}
test('bundle shows reviewed package decisions, bounded approve all, and untrusted note as text', async () => {
	const html = await render(
		data([
			item,
			{
				...item,
				key: 'credential-picks:request-2',
				type: 'credential-picks',
				title: 'Choose a credential',
				canApprove: false,
				canDeny: false,
				statusMessage: 'Choose a credential on its own approval page.',
			},
		]),
	)
	expect(html).toContain('2 changes wait for you')
	expect(html).toContain('Publish changed credentials')
	expect(html).toContain('Choose a credential on its own approval page.')
	expect(html).toContain('data-testid="approval-bundle-approve-all"')
	expect(html.match(/data-testid="approval-bundle-approve"/g)).toHaveLength(1)
	expect(html.match(/data-testid="approval-bundle-deny"/g)).toHaveLength(1)
	expect(html).toContain('&lt;script&gt;untrusted note&lt;/script&gt;')
	expect(html).not.toContain('<script>untrusted note</script>')
	expect(html).toContain('href="/@acme/tool/approve-publish"')
	expect(html).not.toContain('reviewed-fingerprint')
})
test('decided items cannot be resubmitted and expired links retain their clear status', async () => {
	const html = await render(
		data([
			{
				...item,
				status: 'approved',
				decision: { decision: 'approved', decidedAt: '2026-10-14' },
			},
		]),
	)
	expect(html).toContain('All 1 change is decided')
	expect(html).not.toContain('data-testid="approval-bundle-approve"')
	expect(html).not.toContain('data-testid="approval-bundle-deny"')
	expect(html).toMatch(
		/<button[^>]*data-testid="approval-bundle-approve-all"[^>]*disabled/,
	)
	const expired = await render({ ok: false, reason: 'expired' })
	expect(expired).toContain('This link expired')
	expect(expired).not.toContain('data-testid="approval-bundle-approve-all"')
})

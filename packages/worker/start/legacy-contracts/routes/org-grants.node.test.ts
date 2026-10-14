import { jsx } from 'react/jsx-runtime'
import { expect, test } from 'vitest'
import { renderStartPage } from '../../test-support/render-start-page.ts'
import { OrgGrantsPage } from '../../pages/org-management.tsx'
import { type OrgGrantsLoaderData } from '#universal/loader-data.ts'

function grant(
	id: string,
	canRevoke: boolean,
): OrgGrantsLoaderData['grants'][number] {
	return {
		id,
		resourceType: 'package',
		resourceId: 'pkg-1',
		resourceLabel: 'Demo Package',
		subjectType: 'user',
		subjectId: id,
		subjectLabel: `@${id}`,
		preset: 'use',
		presetLabel: 'Use',
		permissions: [],
		createdAt: '2026-01-01T00:00:00.000Z',
		canRevoke,
	}
}

function renderGrants(data: OrgGrantsLoaderData) {
	return renderStartPage(
		jsx(OrgGrantsPage, {
			data,
			queryKey: ['page', 'bob', 'loadOrgGrants', { slug: 'zeta-co' }],
		}),
		'/@zeta-co/-/grants',
	)
}

const org: OrgGrantsLoaderData['org'] = {
	id: 'org-zeta',
	slug: 'zeta-co',
	displayName: 'Zeta Co',
	avatarUrl: null,
	personal: false,
	role: 'member',
}

function row(html: string, grantId: string) {
	const marker = `data-grant-id="${grantId}"`
	const start = html.indexOf(marker)
	expect(start).toBeGreaterThan(-1)
	const next = html.indexOf('data-grant-id=', start + marker.length)
	return html.slice(start, next === -1 ? undefined : next)
}

test('revoke is offered only for grants the viewer may revoke', async () => {
	const html = await renderGrants({
		ok: true,
		org,
		canManage: true,
		grants: [grant('grant-ok', true), grant('grant-denied', false)],
	})

	expect(row(html, 'grant-ok')).toContain('Revoke grant')
	expect(row(html, 'grant-ok')).toContain('>Revoke grant<')
	expect(row(html, 'grant-denied')).not.toContain('Revoke grant')
	expect(row(html, 'grant-denied')).not.toContain('>Revoke grant<')
})

test('a viewer who cannot manage members sees no revoke buttons', async () => {
	const html = await renderGrants({
		ok: true,
		org,
		canManage: false,
		grants: [grant('grant-resource-ok', true)],
	})
	expect(html).toContain('data-grant-id="grant-resource-ok"')
	expect(html).not.toContain('Revoke grant')
})

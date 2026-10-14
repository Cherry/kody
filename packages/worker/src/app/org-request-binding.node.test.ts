import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { createD1FromSqlite } from '#worker/test-support/create-d1-from-sqlite.ts'
import { ensureOrgsTestSchema } from '#worker/orgs/orgs-test-schema.ts'
import {
	isOrgRequestDenied,
	loadRequestOrgResolution,
} from './org-request-binding.ts'

const adaId = 'a'.repeat(64)
const acmeId = 'b'.repeat(64)

async function createEnv() {
	return (await createEnvWithSqlite()).env
}

async function createEnvWithSqlite() {
	const sqlite = new DatabaseSync(':memory:')
	const db = createD1FromSqlite(sqlite)
	await ensureOrgsTestSchema(db)
	const now = '2026-01-01T00:00:00.000Z'
	sqlite
		.prepare(
			`INSERT INTO orgs (id, slug, created_at, updated_at) VALUES (?, 'ada', ?, ?)`,
		)
		.run(adaId, now, now)
	sqlite
		.prepare(
			`INSERT INTO orgs (id, slug, created_at, updated_at) VALUES (?, 'acme', ?, ?)`,
		)
		.run(acmeId, now, now)
	sqlite
		.prepare(
			`INSERT INTO org_memberships (org_id, user_id, role, created_at)
			 VALUES (?, ?, 'owner', ?)`,
		)
		.run(acmeId, adaId, now)
	return { env: { APP_DB: db } as unknown as Env, sqlite }
}

test('RPC scope never comes from Referer or an arbitrary org query', async () => {
	const env = await createEnv()
	for (const referer of [
		'https://kody.test/@acme/-/secrets',
		'https://evil.test/@acme/-/secrets',
	]) {
		await expect(
			loadRequestOrgResolution(
				new Request('https://kody.test/_serverFn/read?org=acme', {
					headers: { referer },
				}),
				env,
				adaId,
			),
		).resolves.toBe('personal')
	}
})

test('organization documents bind their explicit path', async () => {
	const env = await createEnv()
	await expect(
		loadRequestOrgResolution(
			new Request('https://kody.test/@acme/-/memories'),
			env,
			adaId,
		),
	).resolves.toMatchObject({ org: { id: acmeId, slug: 'acme' } })
	await expect(
		isOrgRequestDenied(
			new Request('https://kody.test/@ada/-/memories'),
			env,
			adaId,
		),
	).resolves.toBe(true)
	await expect(
		isOrgRequestDenied(new Request('https://kody.test/@ada'), env, adaId),
	).resolves.toBe(false)
})

test.each(['/connect/oauth', '/account/memories-export.json'])(
	'explicit protocol scope for %s cannot fall back when invalid or inaccessible',
	async (path) => {
		const env = await createEnv()
		await expect(
			loadRequestOrgResolution(
				new Request(`https://kody.test${path}?org=acme`, {
					headers: { referer: 'https://evil.test/@ada/-/memories' },
				}),
				env,
				adaId,
			),
		).resolves.toMatchObject({ org: { id: acmeId, slug: 'acme' } })
		for (const org of ['ada', '', 'Not%20A%20Slug', 'missing']) {
			await expect(
				isOrgRequestDenied(
					new Request(`https://kody.test${path}?org=${org}`),
					env,
					adaId,
				),
			).resolves.toBe(true)
		}
		await expect(
			loadRequestOrgResolution(
				new Request(`https://kody.test${path}`, {
					headers: { referer: 'https://kody.test/@acme/-/memories' },
				}),
				env,
				adaId,
			),
		).resolves.toBe('personal')
	},
)

test('org sections follow the page gate for grant-only collaborators', async () => {
	const { env, sqlite } = await createEnvWithSqlite()
	const now = '2026-01-01T00:00:00.000Z'
	sqlite
		.prepare(`DELETE FROM org_memberships WHERE org_id = ? AND user_id = ?`)
		.run(acmeId, adaId)
	sqlite
		.prepare(
			`INSERT INTO grants (id, org_id, resource_type, resource_id, subject_type,
			   subject_id, preset, created_by_user_id, created_at, updated_at)
			 VALUES ('grant-1', ?, 'secret', 'secret-1', 'user', ?, 'use', ?, ?, ?)`,
		)
		.run(acmeId, adaId, acmeId, now, now)
	const deniedPage = (url: string) =>
		isOrgRequestDenied(new Request(url), env, adaId)
	await expect(deniedPage('https://kody.test/@acme/-/agents')).resolves.toBe(
		false,
	)
	await expect(deniedPage('https://kody.test/@acme/-/memories')).resolves.toBe(
		true,
	)
	await expect(
		deniedPage('https://kody.test/account/memories-export.json?org=acme'),
	).resolves.toBe(true)
	// Management pages check their own permission once the org is bound.
	await expect(deniedPage('https://kody.test/@acme/-/settings')).resolves.toBe(
		false,
	)
})

import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { testOidcSigningEnv } from '#worker/test-support/oidc-signing-env.ts'
import { applyAllMigrations } from '#worker/test-support/apply-all-migrations.ts'
import { createD1FromSqlite } from '#worker/test-support/create-d1-from-sqlite.ts'
import { testStableUserIdFromEmail } from '#worker/test-support/stable-user-id.ts'
import {
	createAuthCookie,
	setAuthSessionSecret,
	type AuthSession,
} from './auth-session.ts'
import { orgRequestIsDenied } from './org-binding-guard-middleware.ts'

const origin = 'https://kody.test'
const cookieSecret = 'LOCAL_TEST_COOKIE_SECRET_32_CHARS_MINIMUM'
const now = '2026-01-01T00:00:00.000Z'
const adaPersonId = testStableUserIdFromEmail('ada@example.com')

function createEnv() {
	const sqlite = new DatabaseSync(':memory:')
	applyAllMigrations(sqlite, new URL('../../migrations/', import.meta.url))
	sqlite
		.prepare(
			`INSERT INTO users (id, username, email, password_hash, stable_user_id)
			 VALUES (1, 'ada', 'ada@example.com', 'x', ?)`,
		)
		.run(adaPersonId)
	const insertOrg = sqlite.prepare(
		`INSERT INTO orgs (id, slug, display_name, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)`,
	)
	insertOrg.run(adaPersonId, 'ada', null, now, now)
	insertOrg.run('org-acme', 'acme', 'Acme', now, now)
	insertOrg.run('org-ghost', 'ghost', 'Ghost', now, now)
	const insertMembership = sqlite.prepare(
		`INSERT INTO org_memberships (org_id, user_id, role, created_at)
		 VALUES (?, ?, 'owner', ?)`,
	)
	insertMembership.run(adaPersonId, adaPersonId, now)
	insertMembership.run('org-acme', adaPersonId, now)
	return {
		env: {
			APP_DB: createD1FromSqlite(sqlite),
			COOKIE_SECRET: cookieSecret,
			SECRET_STORE_KEY: 'LOCAL_TEST_SECRET_STORE_KEY_32_CHARS_MINIMUM',
			...testOidcSigningEnv,
			BUNDLE_ARTIFACTS_KV: {},
			STORAGE_RUNNER: {},
			PACKAGE_REALTIME_SESSION: {},
			MCP_CLIENT_HUB: {},
		} as unknown as Env,
		sqlite,
	}
}

async function adaCookie() {
	setAuthSessionSecret(cookieSecret)
	return createAuthCookie(
		{
			stableUserId: adaPersonId,
			email: 'ada@example.com',
			rememberMe: false,
		} satisfies AuthSession,
		false,
	)
}

test('org-scoped reads and writes deny an org the person cannot use', async () => {
	const { env } = createEnv()
	const cookie = await adaCookie()
	for (const path of [
		'memories',
		'workflows',
		'webhooks',
		'mcp-servers',
		'approvals/bundle-id',
	]) {
		for (const method of ['GET', 'POST']) {
			expect(
				await orgRequestIsDenied(
					new Request(`${origin}/@ghost/-/${path}`, {
						method,
						headers: { Cookie: cookie, Origin: origin },
					}),
					env,
				),
				`${method} ${path}`,
			).toBe(true)
		}
	}
})

test('the guard hands off to the route for orgs the person can use', async () => {
	const { env, sqlite } = createEnv()
	sqlite
		.prepare(
			`INSERT INTO grants (id, org_id, resource_type, resource_id, subject_type,
			   subject_id, preset, created_by_user_id, created_at, updated_at)
			 VALUES ('grant-1', 'org-ghost', 'credential', 'secret-1', 'user', ?, 'use', 'org-ghost', ?, ?)`,
		)
		.run(adaPersonId, now, now)
	const cookie = await adaCookie()
	const run = async (path: string, referer?: string) => {
		const request = new Request(`${origin}${path}`, {
			headers: { Cookie: cookie, ...(referer ? { Referer: referer } : {}) },
		})
		return orgRequestIsDenied(request, env)
	}

	const routed = false
	const notFound = true

	await expect(run('/@acme/-/memories')).resolves.toEqual(routed)
	await expect(run('/account/memories-export.json?org=acme')).resolves.toEqual(
		routed,
	)
	await expect(run('/account/memories-export.json')).resolves.toEqual(routed)
	await expect(run('/_serverFn/read')).resolves.toEqual(routed)
	await expect(run('/@ghost')).resolves.toEqual(routed)
	// A grant opens agents, not the whole workspace or its downloads.
	await expect(run('/@ghost/-/agents')).resolves.toEqual(routed)
	await expect(
		run('/_serverFn/read', `${origin}/@ghost/-/agents`),
	).resolves.toEqual(routed)
	await expect(run('/account/memories-export.json?org=ghost')).resolves.toEqual(
		notFound,
	)
	await expect(run('/@nobody/-/memories')).resolves.toEqual(notFound)
})

test('signed-out requests reach the native route for its own login handling', async () => {
	const { env } = createEnv()
	expect(
		await orgRequestIsDenied(new Request(`${origin}/@ghost/-/memories`), env),
	).toBe(false)
})

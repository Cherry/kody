import { env } from 'cloudflare:workers'
import { expect, test } from 'vitest'
import { createAuthCookie, setAuthSessionSecret } from '#app/auth-session.ts'
import { handlePackageAppOauthAuthorizeRequest } from '#app/package-app-oauth-authorize.ts'
import { packageAppOauthPaths } from '#universal/package-app-oauth-paths.ts'
import { createS256CodeChallenge } from '#app/package-app-oauth-pkce-cookie.ts'
import {
	ensurePackageSubscriptionTestSchema,
	ensureRbacTestSchema,
	seedAccount,
} from '#worker/test-support/workers-seed.ts'
import { ensureOrgsTestSchema } from '#worker/orgs/orgs-test-schema.ts'
import { ensureAuditEventsTestSchema } from '#worker/test-support/audit-events-test-schema.ts'
import { testStableUserIdFromEmail } from '#worker/test-support/stable-user-id.ts'
import { ensureUsersTestSchema } from '#worker/users-test-schema.ts'

const appOrigin = 'https://app.kody.test:8788'
const packageAppOrigin = 'https://packages.isolated.test'
const ownerEmail = 'pkg-oauth-owner@example.com'
const ownerUsername = 'pkgoauth'

function configureOrigins() {
	const mutableEnv = env as unknown as Record<string, string | undefined>
	mutableEnv.APP_BASE_URL = appOrigin
	mutableEnv.PACKAGE_APP_BASE_URL = packageAppOrigin
	// The shared protocol test uses the test bindings, not the SSR build entry.
	mutableEnv.SENTRY_ENVIRONMENT = 'test'
}

async function workerFetch(url: string | URL, init: RequestInit = {}) {
	return handlePackageAppOauthAuthorizeRequest(
		new Request(url, { redirect: 'manual', ...init }),
		env,
		{ allowConsentSkip: false },
	)
}

async function ensureOauthGrantSchema() {
	await env.APP_DB.prepare(
		`CREATE TABLE IF NOT EXISTS package_app_oauth_grants (
			id TEXT PRIMARY KEY NOT NULL,
			person_id TEXT NOT NULL,
			org_username TEXT NOT NULL,
			kody_id TEXT NOT NULL,
			scopes TEXT NOT NULL,
			created_at TEXT NOT NULL,
			revoked_at TEXT
		)`,
	).run()
}

async function seedOwnerSessionCookie() {
	await ensureAuditEventsTestSchema(env.AUDIT_DB)
	await ensureRbacTestSchema(env.APP_DB)
	await ensureOrgsTestSchema(env.APP_DB)
	await ensurePackageSubscriptionTestSchema(env.APP_DB)
	await ensureOauthGrantSchema()
	await ensureUsersTestSchema({
		db: env.APP_DB,
		columns: ['experiments_opt_in'],
	})
	for (const statement of [
		`CREATE TABLE IF NOT EXISTS permissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
			action TEXT NOT NULL,
			entity TEXT NOT NULL,
			access TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS role_permissions (
			role_id INTEGER NOT NULL,
			permission_id INTEGER NOT NULL,
			PRIMARY KEY (role_id, permission_id)
		)`,
	]) {
		await env.APP_DB.prepare(statement).run()
	}
	await seedAccount({
		db: env.APP_DB,
		email: ownerEmail,
		username: ownerUsername,
	})
	setAuthSessionSecret(env.COOKIE_SECRET)
	const setCookie = await createAuthCookie(
		{
			stableUserId: testStableUserIdFromEmail(ownerEmail),
			email: ownerEmail,
			rememberMe: false,
		},
		true,
	)
	return setCookie.split(';')[0] ?? ''
}

test('package-app OAuth authorize refuses unallowlisted redirect_uri', async () => {
	configureOrigins()
	const sessionCookie = await seedOwnerSessionCookie()
	const verifier = 'oauth-workers-test-verifier-32chars!!'
	const challenge = await createS256CodeChallenge(verifier)
	const url = new URL(packageAppOauthPaths.authorize, appOrigin)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('client_id', `${ownerUsername}/demo`)
	url.searchParams.set(
		'redirect_uri',
		'https://evil.example/_kody/auth/callback',
	)
	url.searchParams.set('state', 'state-1')
	url.searchParams.set('code_challenge', challenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('scope', 'profile')

	const response = await workerFetch(url, {
		headers: { Cookie: sessionCookie },
	})
	expect(response).toBeInstanceOf(Response)
	if (!(response instanceof Response))
		throw new Error('Expected redirect refusal')
	expect(response.status).toBe(400)
	await expect(response.text()).resolves.toMatch(/redirect_uri/)
})

test('package-app OAuth authorize returns authenticated consent claims without issuing a code', async () => {
	configureOrigins()
	const sessionCookie = await seedOwnerSessionCookie()
	const verifier = 'oauth-workers-test-verifier-32chars!!'
	const challenge = await createS256CodeChallenge(verifier)
	const redirectUri = `https://${ownerUsername}.packages.isolated.test${packageAppOauthPaths.callback}`
	const url = new URL(packageAppOauthPaths.authorize, appOrigin)
	url.searchParams.set('response_type', 'code')
	url.searchParams.set('client_id', `${ownerUsername}/demo`)
	url.searchParams.set('redirect_uri', redirectUri)
	url.searchParams.set('state', 'state-2')
	url.searchParams.set('code_challenge', challenge)
	url.searchParams.set('code_challenge_method', 'S256')
	url.searchParams.set('scope', 'email')

	const response = await workerFetch(url, {
		headers: { Cookie: sessionCookie },
	})
	expect(response).not.toBeInstanceOf(Response)
	if (response instanceof Response)
		throw new Error('Expected authenticated consent data')
	expect(response.consent).toMatchObject({
		ok: true,
		clientId: `${ownerUsername}/demo`,
		redirectUri,
		publisherUsername: ownerUsername,
		claimLabels: expect.arrayContaining(['See your email address']),
		hiddenFields: {
			state: 'state-2',
			code_challenge: challenge,
			code_challenge_method: 'S256',
			redirect_uri: redirectUri,
		},
	})
})

test('authenticated consent decisions reject a foreign origin before creating a grant', async () => {
	configureOrigins()
	const cookie = await seedOwnerSessionCookie()
	const challenge = await createS256CodeChallenge(
		'oauth-workers-test-verifier-32chars!!',
	)
	const response = await workerFetch(
		new URL(packageAppOauthPaths.authorize, appOrigin),
		{
			method: 'POST',
			headers: {
				Cookie: cookie,
				Origin: 'https://evil.example',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				response_type: 'code',
				client_id: `${ownerUsername}/demo`,
				redirect_uri: `https://${ownerUsername}.packages.isolated.test${packageAppOauthPaths.callback}`,
				code_challenge: challenge,
				code_challenge_method: 'S256',
				scope: 'email',
				decision: 'approve',
			}),
		},
	)
	expect(response).toBeInstanceOf(Response)
	if (!(response instanceof Response))
		throw new Error('Expected origin refusal')
	expect(response.status).toBe(403)
	const row = await env.APP_DB.prepare(
		'SELECT COUNT(*) AS count FROM package_app_oauth_grants',
	).first<{ count: number }>()
	expect(row?.count).toBe(0)
})

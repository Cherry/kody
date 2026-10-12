import { ownerIdFromStored } from '@kody-internal/shared/owner-person-ids.ts'
import { expect, test } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { createRouter } from 'remix/router'
import { applyAllMigrations } from '#worker/test-support/apply-all-migrations.ts'
import { createD1FromSqlite } from '#worker/test-support/create-d1-from-sqlite.ts'
import { testCookieSecret } from '#worker/test-support/auth-provider-harness.ts'
import { loadUnsubscribeTipsPage } from '#app/handlers/unsubscribe-tips.ts'
import { routes } from '#universal/routes.ts'
import {
	createTipsUnsubscribeToken,
	isTipsEmailsOptedOut,
	tipsUnsubscribeOneClickBody,
} from '#worker/usage/tips-unsubscribe.ts'

function createDb() {
	const sqlite = new DatabaseSync(':memory:')
	applyAllMigrations(sqlite, new URL('../../../migrations/', import.meta.url))
	return createD1FromSqlite(sqlite)
}

async function insertUser(db: D1Database, userId = 'user-tips') {
	await db
		.prepare(
			`INSERT INTO users (username, email, password_hash, stable_user_id)
			 VALUES ('tips', 'tips@example.com', 'x', ?)`,
		)
		.bind(userId)
		.run()
}

function createEnv(db: D1Database) {
	return {
		APP_DB: db,
		COOKIE_SECRET: testCookieSecret,
	} as unknown as Env
}

test('unsubscribe-tips GET applies opt-out and POST accepts RFC one-click', async () => {
	const db = createDb()
	await insertUser(db)
	const env = createEnv(db)

	const token = await createTipsUnsubscribeToken({
		env,
		userId: ownerIdFromStored('user-tips'),
	})

	const missing = await loadUnsubscribeTipsPage(
		new Request('https://example.com/unsubscribe/tips'),
		env,
	)
	expect(missing).toMatchObject({
		status: 400,
		loaderData: {
			tipsUnsubscribe: {
				ok: false,
				error: 'Unsubscribe token is required.',
			},
		},
	})

	const getUrl = `https://example.com/unsubscribe/tips?token=${encodeURIComponent(token)}`
	const first = await loadUnsubscribeTipsPage(new Request(getUrl), env)
	expect(first).toMatchObject({
		loaderData: {
			tipsUnsubscribe: {
				ok: true,
				alreadyOptedOut: false,
				message: expect.stringContaining('unsubscribed from Kody tips'),
			},
		},
	})
	expect(
		await isTipsEmailsOptedOut({ db, userId: ownerIdFromStored('user-tips') }),
	).toBe(true)

	const again = await loadUnsubscribeTipsPage(new Request(getUrl), env)
	expect(again).toMatchObject({
		loaderData: {
			tipsUnsubscribe: { ok: true, alreadyOptedOut: true },
		},
	})

	const otherDb = createDb()
	await insertUser(otherDb, 'user-one-click')
	const otherEnv = createEnv(otherDb)

	const postToken = await createTipsUnsubscribeToken({
		env: otherEnv,
		userId: ownerIdFromStored('user-one-click'),
	})
	const postUrl = `https://example.com/unsubscribe/tips?token=${encodeURIComponent(postToken)}`
	const posted = await loadUnsubscribeTipsPage(
		new Request(postUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: tipsUnsubscribeOneClickBody,
		}),
		otherEnv,
	)
	expect(posted).toBeInstanceOf(Response)
	if (!(posted instanceof Response)) throw new Error('Expected POST response')
	expect(posted.status).toBe(200)
	expect(await posted.text()).toContain('unsubscribed from Kody tips')
	expect(
		await isTipsEmailsOptedOut({
			db: otherDb,
			userId: ownerIdFromStored('user-one-click'),
		}),
	).toBe(true)
})

test('string-literal unsubscribeTips route accepts RFC one-click POST', async () => {
	let method = ''
	const router = createRouter()
	router.map(
		{ unsubscribeTips: routes.unsubscribeTips },
		{
			actions: {
				unsubscribeTips: {
					middleware: [],
					async handler({ request }) {
						method = request.method
						return new Response('posted')
					},
				},
			},
		},
	)
	const posted = await router.fetch(
		new Request('http://localhost/unsubscribe/tips?token=x', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: tipsUnsubscribeOneClickBody,
		}),
	)
	expect(posted.status).toBe(200)
	expect(await posted.text()).toBe('posted')
	expect(method).toBe('POST')
})

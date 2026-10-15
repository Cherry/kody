import { assertInactiveConfig } from './start-opt-in-inactive-config.ts'
import { expect, test } from 'vitest'
import {
	assertProductionSnapshot,
	assertSharedBindings,
	collectCandidateSecrets,
} from './deploy-start-opt-in.ts'

const inactive = () => ({
	name: 'kody-start-router',
	workers_dev: false,
	preview_urls: false,
})
test('rejects ingress, schema and resource ownership changes', () => {
	expect(() =>
		assertInactiveConfig(inactive(), 'kody-start-router'),
	).not.toThrow()
	for (const key of ['routes', 'migrations', 'triggers', 'env', 'unsafe'])
		expect(() =>
			assertInactiveConfig({ ...inactive(), [key]: [] }, 'kody-start-router'),
		).toThrow(key)
	expect(() =>
		assertInactiveConfig(
			{ ...inactive(), queues: { consumers: [] } },
			'kody-start-router',
		),
	).toThrow('queues.consumers')
	expect(() =>
		assertInactiveConfig(
			{
				...inactive(),
				durable_objects: { bindings: [{ name: 'DO', class_name: 'Local' }] },
			},
			'kody-start-router',
		),
	).toThrow('durable_objects.bindings.script_name')
	expect(() => assertInactiveConfig(inactive(), 'kody-production')).toThrow(
		'name',
	)
})
test('requires trusted cookie and encryption secrets and rejects unknown live secret mappings', () => {
	expect(() => collectCandidateSecrets([], {})).toThrow('COOKIE_SECRET')
	expect(() =>
		collectCandidateSecrets([], { COOKIE_SECRET: 'cookie' }),
	).toThrow('SECRET_STORE_KEY')
	expect(() =>
		collectCandidateSecrets(['UNKNOWN'], {
			COOKIE_SECRET: 'cookie',
			SECRET_STORE_KEY: 'store',
		}),
	).toThrow('reviewed secret mapping')
	expect(() =>
		collectCandidateSecrets(['STRIPE_SECRET_KEY'], {
			COOKIE_SECRET: 'cookie',
			SECRET_STORE_KEY: 'store',
		}),
	).toThrow('STRIPE_SECRET_KEY')
	expect(
		collectCandidateSecrets(['CLOUDFLARE_API_TOKEN'], {
			COOKIE_SECRET: 'cookie',
			SECRET_STORE_KEY: 'store',
			CLOUDFLARE_API_TOKEN: 'deploy-token',
			CLOUDFLARE_APP_API_TOKEN: 'application-token',
		}),
	).toEqual({
		COOKIE_SECRET: 'cookie',
		SECRET_STORE_KEY: 'store',
		CLOUDFLARE_API_TOKEN: 'application-token',
	})
})
test('refuses resource drift or extra bindings between review and deployment', () => {
	const production = {
		vars: { APP_BASE_URL: 'https://kody.codes' },
		d1_databases: [{ binding: 'APP_DB', database_id: 'live-id' }],
		services: [
			{ binding: 'JOBS', service: 'kody-jobs', entrypoint: 'JobsService' },
		],
		queues: { producers: [{ binding: 'QUEUE', queue: 'live-queue' }] },
	}
	expect(() =>
		assertSharedBindings(structuredClone(production), production),
	).not.toThrow()
	const changed = structuredClone(production)
	changed.d1_databases[0]!.database_id = 'different-id'
	expect(() => assertSharedBindings(changed, production)).toThrow(
		'Shared d1_databases',
	)
	const added = structuredClone(production)
	added.services.push({
		binding: 'EXTRA',
		service: 'another-worker',
		entrypoint: 'JobsService',
	})
	expect(() => assertSharedBindings(added, production)).toThrow(
		'Shared services',
	)
	const queueChanged = structuredClone(production)
	queueChanged.queues.producers[0]!.queue = 'other-queue'
	expect(() => assertSharedBindings(queueChanged, production)).toThrow(
		'Shared queues',
	)
})

test.each([
	{
		field: 'artifacts',
		value: [{ binding: 'ARTIFACTS', namespace: 'changed' }],
	},
	{
		field: 'vars',
		value: { APP_BASE_URL: 'https://kody.codes', FEATURE: 'changed' },
	},
	{ field: 'compatibility_date', value: '2026-10-15' },
	{ field: 'compatibility_flags', value: ['nodejs_compat', 'new_flag'] },
	{ field: 'ai', value: { binding: 'DIFFERENT_AI' } },
	{ field: 'images', value: { binding: 'DIFFERENT_IMAGES' } },
	{ field: 'version_metadata', value: { binding: 'DIFFERENT_VERSION' } },
	{ field: 'worker_loaders', value: [{ binding: 'DIFFERENT_LOADER' }] },
	{
		field: 'send_email',
		value: [{ name: 'EMAIL', destination_address: 'changed@example.com' }],
	},
	{
		field: 'ratelimits',
		value: [
			{ name: 'AUTH', namespace_id: '1', simple: { limit: 999, period: 60 } },
		],
	},
	{ field: 'futureCopiedField', value: { enabled: false } },
])('rejects complete snapshot drift in $field', ({ field, value }) => {
	const snapshot = {
		vars: { APP_BASE_URL: 'https://kody.codes', FEATURE: 'original' },
		artifacts: [{ binding: 'ARTIFACTS', namespace: 'production' }],
		compatibility_date: '2026-04-16',
		compatibility_flags: ['nodejs_compat'],
		ai: { binding: 'AI' },
		images: { binding: 'IMAGES' },
		version_metadata: { binding: 'CF_VERSION_METADATA' },
		worker_loaders: [{ binding: 'LOADER' }],
		send_email: [{ name: 'EMAIL' }],
		ratelimits: [
			{ name: 'AUTH', namespace_id: '1', simple: { limit: 10, period: 60 } },
		],
		futureCopiedField: { enabled: true },
	}
	expect(() =>
		assertProductionSnapshot(
			snapshot,
			{ ...snapshot, [field]: value },
			['COOKIE_SECRET'],
			['COOKIE_SECRET'],
		),
	).toThrow('Production configuration changed')
	// Build verification also compares every copied field, including future ones.
	expect(() =>
		assertSharedBindings({ ...snapshot, [field]: value }, snapshot),
	).toThrow(`Shared ${field}`)
})

test('normalizes object and binding order while preserving all values and secret names', () => {
	const snapshot = {
		vars: { B: 'b', A: 'a' },
		services: [
			{ binding: 'B', service: 'two' },
			{ binding: 'A', service: 'one' },
		],
	}
	const reordered = {
		services: [
			{ service: 'one', binding: 'A' },
			{ service: 'two', binding: 'B' },
		],
		vars: { A: 'a', B: 'b' },
	}
	expect(() =>
		assertProductionSnapshot(
			snapshot,
			reordered,
			['COOKIE_SECRET', 'SECRET_STORE_KEY'],
			['SECRET_STORE_KEY', 'COOKIE_SECRET'],
		),
	).not.toThrow()
	expect(() =>
		assertProductionSnapshot(
			snapshot,
			reordered,
			['COOKIE_SECRET'],
			['COOKIE_SECRET', 'NEW_SECRET'],
		),
	).toThrow('Production secret names changed')
	expect(() =>
		assertProductionSnapshot(
			snapshot,
			reordered,
			['COOKIE_SECRET', 'SECRET_STORE_KEY'],
			['COOKIE_SECRET'],
		),
	).toThrow('Production secret names changed')
})

test('preserves JSON variable array order during complete snapshot comparison', () => {
	const snapshot = { vars: { ORDERED_STEPS: ['read', 'write'] } }
	const changed = { vars: { ORDERED_STEPS: ['write', 'read'] } }
	expect(() => assertProductionSnapshot(snapshot, changed, [], [])).toThrow(
		'Production configuration changed',
	)
})

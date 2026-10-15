import { expect, test } from 'vitest'
import { probeRequest, type ProbeEnv } from './start-opt-in-probe-worker.ts'
import { inspectPublicDocument } from './probe-start-opt-in.ts'

function fixture() {
	const calls: Array<{ lane: string; request: Request }> = []
	const service = (lane: string) => ({
		fetch: async (request: Request) => {
			calls.push({ lane, request })
			return new Response('public body', {
				headers: {
					'Content-Type': 'text/html',
					'Set-Cookie': 'private=value',
					'X-Internal': 'private',
				},
			})
		},
	})
	const env: ProbeEnv = {
		START: service('start'),
		LEGACY: service('legacy'),
		ROUTER: service('router'),
		PROBE_KEY: 'a'.repeat(64),
		START_RELEASE: 'b'.repeat(40),
		ASSET_PATHS: JSON.stringify(['assets/site.js', 'styles.css']),
	}
	const request = (route: string, options?: RequestInit) =>
		new Request(`http://127.0.0.1${route}`, {
			...options,
			headers: { 'X-Kody-Probe-Key': env.PROBE_KEY, ...options?.headers },
		})
	return { calls, env, request }
}
test('probe permits only read-only fixed cases and strips all incoming credentials', async () => {
	const { calls, env, request } = fixture()
	await probeRequest(
		request('/start/document', {
			headers: {
				Cookie: 'real-session=must-not-forward',
				Authorization: 'Bearer must-not-forward',
			},
		}),
		env,
	)
	expect(calls).toHaveLength(1)
	expect(calls[0]!.request.url).toBe('https://kody.codes/')
	expect(calls[0]!.request.headers.get('Cookie')).toBeNull()
	expect(calls[0]!.request.headers.get('Authorization')).toBeNull()
	expect(calls[0]!.request.headers.get('X-Kody-Probe-Key')).toBeNull()
	expect(
		(await probeRequest(request('/start/document', { method: 'POST' }), env))
			.status,
	).toBe(403)
	expect(
		(await probeRequest(request('/arbitrary/production/write'), env)).status,
	).toBe(404)
	expect(
		(await probeRequest(new Request('http://127.0.0.1/start/document'), env))
			.status,
	).toBe(403)
	expect(calls).toHaveLength(1)
})
test('forwards only manifest-listed assets and rejects normalization tricks', async () => {
	const { calls, env, request } = fixture()
	await probeRequest(request('/router/asset?path=assets%2Fsite.js'), env)
	expect(calls[0]!.lane).toBe('router')
	expect(calls[0]!.request.url).toBe(
		`https://kody.codes/__start/${env.START_RELEASE}/assets/site.js`,
	)
	for (const asset of [
		'../secret',
		'_serverFn/read',
		'/styles.css',
		'styles.css?x=1',
		'styles.css%00',
	])
		expect(
			(
				await probeRequest(
					request(`/router/asset?path=${encodeURIComponent(asset)}`),
					env,
				)
			).status,
		).toBe(404)
	expect(calls).toHaveLength(1)
})
test('cannot leak set-cookie or internal headers to the probe caller', async () => {
	const { env, request } = fixture()
	const result = await probeRequest(request('/router/document'), env)
	expect(result.headers.get('Set-Cookie')).toBeNull()
	expect(result.headers.get('X-Internal')).toBeNull()
	expect(result.headers.get('X-Probe-Content-Type')).toBe('text/html')
	expect(result.headers.get('Cache-Control')).toBe('no-store')
})
test('denial probes use GET without minting an account session or preference', async () => {
	const { calls, env, request } = fixture()
	await probeRequest(request('/router/opt-in'), env)
	await probeRequest(request('/router/rpc'), env)
	await probeRequest(request('/router/invalid-preference'), env)
	expect(calls.map((call) => call.request.method)).toEqual([
		'GET',
		'GET',
		'GET',
	])
	expect(calls[0]!.request.url).toBe('https://kody.codes/__start/opt-in')
	expect(calls[1]!.request.url).toContain('/_serverFn/probe-nonexistent')
	expect(calls[0]!.request.headers.get('Cookie')).toBeNull()
	expect(calls[1]!.request.headers.get('Cookie')).toBeNull()
	expect(calls[2]!.request.headers.get('Cookie')).toBe(
		'__Host-kody_start=invalid-signature',
	)
})
test('public document proof requires exact release namespace and complete HTML', () => {
	const release = 'b'.repeat(40)
	expect(() =>
		inspectPublicDocument('<!doctype html><title>Kody</title>', release, false),
	).not.toThrow()
	expect(() =>
		inspectPublicDocument(
			`<!doctype html><title>Kody</title><script src="/__start/${release}/assets/site.js"></script>`,
			release,
			true,
		),
	).not.toThrow()
	expect(() =>
		inspectPublicDocument('<!doctype html><title>Kody</title>', release, true),
	).toThrow('lacks its exact')
	expect(() => inspectPublicDocument('error', release, false)).toThrow(
		'not complete HTML',
	)
})

import { expect, test } from 'vitest'
import { createOpenApiTestHarness } from '#worker/test-support/open-api-http.ts'

test('POST /v1/tokens/device mints a kody_at_ token from CLI OAuth', async () => {
	const api = await createOpenApiTestHarness({
		oauthAccessToken: 'oauth-cli-login',
	})
	const minted = await api.call('POST', '/v1/tokens/device', {
		token: 'oauth-cli-login',
		body: { lifetime: 'long', name: 'kody-cli' },
	})
	expect(minted.status).toBe(200)
	expect(minted.body['token']).toEqual(expect.stringMatching(/^kody_at_/))
	expect(minted.body['created_via']).toBe('cli-login')
	expect(minted.body['org_binding']).toBe('user')
	expect(minted.body['login_org']).toEqual({
		slug: expect.any(String),
	})
	expect(minted.body['scopes']).toEqual(
		expect.arrayContaining(['org:execute', 'search:read']),
	)
})

test('POST /v1/tokens/device rejects a kody_at_ bearer', async () => {
	const api = await createOpenApiTestHarness()
	const token = await api.mint(['org:execute'])
	const response = await api.call('POST', '/v1/tokens/device', {
		token,
		body: { lifetime: 'short' },
	})
	expect(response.status).toBe(400)
	expect(response.body.error?.code).toBe('invalid_request')
})

test('POST /v1/execute rejects CLI OAuth and accepts the route for kody_at_', async () => {
	const api = await createOpenApiTestHarness({
		oauthAccessToken: 'oauth-cli-login',
	})
	const oauth = await api.call('POST', '/v1/execute', {
		token: 'oauth-cli-login',
		body: { code: 'export default () => 1' },
	})
	expect(oauth.status).toBe(401)

	const token = await api.mint(['org:read'])
	const missing = await api.call('POST', '/v1/execute', {
		token,
		body: { code: 'export default () => 1' },
	})
	expect(missing.status).toBe(403)
	expect(missing.body.error?.code).toBe('insufficient_scope')
})

import { expect, test } from 'vitest'
import {
	createUniqueTestUser,
	getSharedMcpE2eServer,
} from '../../../tools/mcp-test-support.ts'
import { loginToApp } from '../../../tools/mcp-oauth-client.ts'

async function readDocument(path: string, cookie?: string) {
	const server = await getSharedMcpE2eServer()
	const response = await fetch(new URL(path, server.origin), {
		headers: cookie ? { Cookie: cookie } : {},
		redirect: 'manual',
	})
	const html = (await response.text())
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
	return { response, html }
}

test('native token error documents retain status and actionable recovery', async () => {
	for (const [path, marker] of [
		['/verify-email', 'Verification token is required.'],
		['/verify-email-destination', 'Resend from email inbox'],
		['/unsubscribe/tips', 'Unsubscribe token is required.'],
	] as const) {
		const { response, html } = await readDocument(path)
		expect(response.status).toBe(400)
		expect(html).toContain(marker)
		expect(html).not.toContain('data-testid="internal-error-page"')
	}
})

test('native secret connection pages require login and retain setup values', async () => {
	for (const path of [
		'/connect/secrets',
		'/connect/secret-set?name=exampleApiKey',
	]) {
		const { response } = await readDocument(path)
		expect(response.status).toBe(302)
		expect(response.headers.get('Location')).toContain('/login')
	}
	const server = await getSharedMcpE2eServer()
	const user = createUniqueTestUser()
	await server.ensureUser(user)
	const cookie = await loginToApp(server.origin, user)
	const { response, html } = await readDocument(
		'/connect/secret-set?name=exampleApiKey&allowedHosts=api.example.com',
		cookie,
	)
	expect(response.status).toBe(200)
	expect(html).toContain('exampleApiKey')
	expect(html).toContain('api.example.com')
	expect(html).toContain('Set secret')
	expect(html).not.toContain('data-testid="internal-error-page"')
	const prefilled = await readDocument(
		`/@${user.username}/-/secrets/new?name=exampleApiKey&allowedHosts=api.example.com`,
		cookie,
	)
	expect(prefilled.response.status).toBe(302)
	expect(prefilled.response.headers.get('Location')).toBe(
		'/connect/secret-set?name=exampleApiKey&allowedHosts=api.example.com',
	)
	const bare = await readDocument(`/@${user.username}/-/secrets/new`, cookie)
	expect(bare.response.status).toBe(200)
	expect(bare.html).toContain('Secrets')
	const approval = await readDocument(
		'/connect/secrets?name=exampleApiKey&hosts=api.example.com',
		cookie,
	)
	expect(approval.response.status).toBe(200)
	expect(approval.html).toContain('Allow secret hosts')
})

test('native anonymous onboarding renders every wizard step and canonicalizes invalid choices', async () => {
	for (const path of [
		'/onboarding/step-1',
		'/onboarding/step-2',
		'/onboarding/step-3',
		'/onboarding/step-3/claude-code',
	]) {
		const { response, html } = await readDocument(path)
		expect(response.status).toBe(200)
		expect(html).toContain('<h1')
		expect(html).not.toContain('data-testid="internal-error-page"')
		if (path === '/onboarding/step-1') {
			for (const marker of [
				'onboarding-steps-nav',
				'onboarding-agent-picker',
				'onboarding-join-discord',
				'onboarding-step-2',
			])
				expect(html).toContain(marker)
			const positions = [
				'onboarding-steps-nav',
				'onboarding-agent-picker',
				'onboarding-join-discord',
			].map((marker) => html.indexOf(marker))
			expect(positions).toEqual([...positions].sort((a, b) => a - b))
			expect(html).toContain('href="/onboarding/step-2"')
		}
	}
	for (const [path, destination] of [
		['/onboarding', '/onboarding/step-1'],
		['/onboarding?redirectTo=%2F', '/onboarding/step-1?redirectTo=%2F'],
		['/onboarding/step-1/nope', '/onboarding/step-1'],
		['/onboarding/step-2/not-listed', '/onboarding/step-2'],
		[
			'/onboarding/step-3/not-listed?redirectTo=%2F',
			'/onboarding/step-3?redirectTo=%2F',
		],
	] as const) {
		const { response } = await readDocument(path)
		expect(response.status).toBe(307)
		const location = new URL(
			response.headers.get('Location')!,
			'https://example.com',
		)
		expect(location.pathname + location.search).toBe(destination)
	}
})

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type * as React from 'react'
import type * as Router from '@tanstack/react-router'
const state = vi.hoisted(() => ({
	social: vi.fn(),
	session: vi.fn(),
	resend: vi.fn(),
	navigate: vi.fn(),
	assign: vi.fn(),
}))
vi.mock('react', async (importOriginal) => ({
	...(await importOriginal<typeof React>()),
	useCallback: (callback: unknown) => callback,
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
	...(await importOriginal<typeof Router>()),
	useRouter: () => ({
		stores: { location: { get: () => ({ href: '/account/passkeys' }) } },
		resolveRedirect: (redirect: unknown) => redirect,
		navigate: state.navigate,
	}),
}))
vi.mock('#start/server/auth-mutations', () => ({
	startWebsiteOAuth: state.social,
	readWebsiteAuthProviders: vi.fn(),
	resendWebsiteVerification: state.resend,
}))
vi.mock('#start/server/session-info', () => ({
	readWebsiteSessionInfo: state.session,
}))
import { redirect } from '@tanstack/react-router'
import { useSocialSignIn } from './social-sign-in.ts'
import { useSessionInfo } from './session-info.ts'
import { useResendVerification } from './pages/email-verification-prompt.tsx'
beforeEach(() => {
	vi.clearAllMocks()
	state.navigate.mockResolvedValue(undefined)
	vi.stubGlobal('window', { location: { assign: state.assign } })
})

afterEach(() => vi.unstubAllGlobals())

test('imperative auth hooks honor native identity reloads without continuing success work', async () => {
	const identityChanged = () =>
		redirect({ href: '/account/passkeys', reloadDocument: true, replace: true })
	state.social.mockRejectedValue(identityChanged())
	state.session.mockRejectedValue(identityChanged())
	state.resend.mockRejectedValue(identityChanged())
	expect(await useSocialSignIn()('github', null)).toBeNull()
	expect(await useSessionInfo()()).toBeUndefined()
	expect(await useResendVerification()()).toBeUndefined()
	expect(state.navigate).toHaveBeenCalledTimes(3)
	expect(state.navigate).toHaveBeenCalledWith(
		expect.objectContaining({
			href: '/account/passkeys',
			reloadDocument: true,
			replace: true,
		}),
	)
	expect(state.assign).not.toHaveBeenCalled()
})

test('successful social authorization and resend retain their real result', async () => {
	state.social.mockResolvedValue({
		successful: true,
		ok: true,
		authorizeUrl: 'https://github.com/login/oauth/authorize',
	})
	state.resend.mockResolvedValue({
		successful: true,
		ok: true,
		message: 'Sent.',
	})
	expect(await useSocialSignIn()('github', '/account')).toBeNull()
	expect(state.assign).toHaveBeenCalledWith(
		'https://github.com/login/oauth/authorize',
	)
	expect(await useResendVerification()('/account')).toEqual({
		ok: true,
		message: 'Sent.',
	})
	expect(state.navigate).not.toHaveBeenCalled()
})

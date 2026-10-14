import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const updatePasskey = createServerFn({ method: 'POST' })
	.validator((body: Record<string, unknown>) => z.object({ intent: z.enum(['delete', 'rename']), passkeyId: z.string(), name: z.string().optional() }).parse(body))
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { mutatePasskeys } = await import('../../src/app/handlers/account-passkeys.ts')
		return withWebsiteMutation({}, async context => {
 const result = await mutatePasskeys({ ...context, body: data })
 if ('error' in result) throw new Error(result.error)
 return result
 })
	})

export const updateTwoFactor = createServerFn({ method: 'POST' })
	.validator((body: Record<string, unknown>) => z.object({ intent: z.enum(['setup', 'confirm', 'cancel', 'disable']), code: z.string().optional() }).parse(body))
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { mutateTwoFactor } = await import('../../src/app/handlers/account-two-factor.ts')
		return withWebsiteMutation({}, context => mutateTwoFactor({ ...context, body: data }))
	})

export const changePassword = createServerFn({ method: 'POST' })
	.validator(z.object({ currentPassword: z.string().optional(), newPassword: z.string() }))
	.handler(async ({ data }) => {
		const { withWebsiteMutation } = await import('./mutation-context.ts')
		const { changeAccountPassword } = await import('../../src/app/handlers/account-password.ts')
		const { setResponseHeader } = await import('@tanstack/react-start/server')
		return withWebsiteMutation({}, async context => {
			const result = await changeAccountPassword({...context, body:data})
			if (result.sessionCookie) setResponseHeader('Set-Cookie', result.sessionCookie)
			if (result.retryAfter) setResponseHeader('Retry-After', result.retryAfter)
			return result.payload
		})
	})

export const deleteOwnAccount = createServerFn({ method: 'POST' })
	.validator(z.object({confirmation:z.string(),password:z.string().optional()}))
	.handler(async ({data}) => {
		const { env } = await import('cloudflare:workers')
		const { getEnv } = await import('#app/env.ts')
		const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server')
		const { readAuthenticatedAppUserForDeletion } = await import('#app/authenticated-user.ts')
		const { deleteAccount } = await import('../../src/app/handlers/account-delete.ts')
		const request = getRequest()
		const bindings = getEnv(env)
		const user = await readAuthenticatedAppUserForDeletion(request, bindings)
		if (!user) throw new Error('Please sign in again.')
		// Deletion acquires its exclusive lifecycle lock itself, never a normal write lease.
		const result = await deleteAccount({env:bindings,request,user,body:data})
		if ('sessionCookie' in result && result.sessionCookie) setResponseHeader('Set-Cookie',result.sessionCookie)
		return result.payload
	})

export const signOut = createServerFn({method:'POST'}).handler(async () => {
	const { getRequest, setResponseHeader } = await import('@tanstack/react-start/server')
	const { destroyAuthCookie, isSecureRequest, setAuthSessionSecret } = await import('#app/auth-session.ts')
	const { env } = await import('cloudflare:workers')
	const { getEnv } = await import('#app/env.ts')
	setAuthSessionSecret(getEnv(env).COOKIE_SECRET)
	setResponseHeader('Set-Cookie', await destroyAuthCookie(isSecureRequest(getRequest())))
	return {ok:true}
})

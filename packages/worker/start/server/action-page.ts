import { createServerFn } from '@tanstack/react-start'
import type { AppPageResult } from '../../src/app/page-result.ts'

function tokenInput(data: {
	token: string | null
	redirectTo?: string | null
}) {
	if (
		!data ||
		(data.token !== null && typeof data.token !== 'string') ||
		(data.redirectTo != null && typeof data.redirectTo !== 'string')
	)
		throw new Error('Invalid token input')
	return { token: data.token, redirectTo: data.redirectTo }
}

async function tokenContext() {
	const [{ env }, { getRequest }, { getEnv }] = await Promise.all([
		import('cloudflare:workers'),
		import('@tanstack/react-start/server'),
		import('../../src/app/env.ts'),
	])
	return { request: getRequest(), env: getEnv(env) }
}

async function pageResult(result: AppPageResult | Response) {
	if (result instanceof Response)
		throw new Error('Unexpected non-page token result')
	const { setResponseStatus, setResponseHeader } =
		await import('@tanstack/react-start/server')
	setResponseStatus(result.status ?? 200)
	if (result.extraSetCookies?.length)
		setResponseHeader('Set-Cookie', result.extraSetCookies)
	return { title: result.title, loaderData: result.loaderData }
}

export const loadVerifyEmail = createServerFn({ method: 'GET' })
	.validator(tokenInput)
	.handler(async ({ data }) => {
		const { executeVerifyEmail } =
			await import('../../src/app/handlers/verify-email.ts')
		return pageResult(
			await executeVerifyEmail({ ...(await tokenContext()), ...data }),
		)
	})

export const loadVerifyEmailChange = createServerFn({ method: 'GET' })
	.validator(tokenInput)
	.handler(async ({ data }) => {
		const { executeVerifyEmailChange } =
			await import('../../src/app/handlers/verify-email-change.ts')
		return pageResult(
			await executeVerifyEmailChange({ ...(await tokenContext()), ...data }),
		)
	})

export const loadVerifyEmailClaimRelease = createServerFn({ method: 'GET' })
	.validator(tokenInput)
	.handler(async ({ data }) => {
		const { executeVerifyEmailClaimRelease } =
			await import('../../src/app/handlers/verify-email-claim-release.ts')
		return pageResult(
			await executeVerifyEmailClaimRelease({
				...(await tokenContext()),
				...data,
			}),
		)
	})

export const loadVerifyEmailDestination = createServerFn({ method: 'GET' })
	.validator(tokenInput)
	.handler(async ({ data }) => {
		const { executeVerifyEmailDestination } =
			await import('../../src/app/handlers/verify-email-destination.ts')
		return pageResult(
			await executeVerifyEmailDestination({
				...(await tokenContext()),
				...data,
				consume: true,
			}),
		)
	})

export const loadUnsubscribeTips = createServerFn({ method: 'GET' })
	.validator(tokenInput)
	.handler(async ({ data }) => {
		const { executeUnsubscribeTips } =
			await import('../../src/app/handlers/unsubscribe-tips.ts')
		return pageResult(
			await executeUnsubscribeTips({
				...(await tokenContext()),
				...data,
				oneClick: false,
			}),
		)
	})

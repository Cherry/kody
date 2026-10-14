// Keep the incoming HEAD method intact so verification checks the token without
// consuming it or sending the verification audit event.
export async function verifyEmailDestinationHead({
	request,
}: {
	request: Request
}) {
	const [{ env }, { getEnv }, { loadVerifyEmailDestinationPage }] =
		await Promise.all([
			import('cloudflare:workers'),
			import('../../src/app/env.ts'),
			import('../../src/app/handlers/verify-email-destination.ts'),
		])
	const result = await loadVerifyEmailDestinationPage(request, getEnv(env))
	if (result instanceof Response) return result
	throw new Error('Expected a read-only verification response')
}

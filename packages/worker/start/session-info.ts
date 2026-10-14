import { parseSessionInfo } from '#client/session.ts'
import { readWebsiteSessionInfo } from '#start/server/session-info'
export async function fetchSessionInfo(signal?: AbortSignal) {
	try {
		const session = await readWebsiteSessionInfo({ signal })
		return signal?.aborted ? null : parseSessionInfo({ ok: true, session })
	} catch {
		return null
	}
}

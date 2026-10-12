import { type AppLoaderData } from '#universal/loader-data.ts'
import {
	absolutizeDocumentHead,
	resolveDocumentHead,
} from '#universal/document-head.ts'
import { getCanonicalAppBaseUrl } from '#worker/app-base-url.ts'
import { getEnv } from '#app/env.ts'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'

/** Called only inside server functions, using configured canonical origin. */
export function loadDocumentHead(
	pathname: string,
	data?: Partial<AppLoaderData>,
	search = '',
) {
	return absolutizeDocumentHead(
		resolveDocumentHead(pathname, data, search),
		getCanonicalAppBaseUrl({ env: getEnv(env), requestUrl: getRequest().url }),
	)
}

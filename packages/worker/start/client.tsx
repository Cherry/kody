/** @jsxImportSource react */
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import {
	captureClientException,
	initSentryClient,
} from '#client/sentry-client.ts'

initSentryClient(document)

function reportReactError(error: unknown) {
	console.error('React client error:', error)
	captureClientException(error)
}

startTransition(() => {
	hydrateRoot(
		document,
		<StrictMode>
			<StartClient />
		</StrictMode>,
		{
			onCaughtError: reportReactError,
			onUncaughtError: reportReactError,
			onRecoverableError: reportReactError,
		},
	)
})

/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadPackagesIndexPage } from '#start/server/account-collections'
export const Route = createFileRoute('/account_/packages/')({
	loaderDeps: ({ search }) => search,
	loader: ({ abortController, location }) =>
		loadPackagesIndexPage({
			signal: abortController.signal,
			data: location.pathname.replace(/\/$/, '') + location.searchStr,
		}),
})

/** @jsxImportSource @emotion/react */
import { useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { CopyTextButton } from '../components/copy-text-button.tsx'
import { NotFoundPage } from '../components/not-found-page.tsx'
import { resolvePackageListIconUrl } from '#universal/identity-icon-urls.ts'
import {
	type PackageCredentialsLoaderData,
	type PackageCredentialsTab,
	readPackageCredentialsTabPath,
} from '#universal/package-credentials-page.ts'
import {
	fallbackDefaultBranchName,
	getPackageTreeHref,
} from '#universal/package-files.ts'
import { renderPackageRepoChrome } from '../components/package-repo-nav.tsx'
import { cardCss, cardTitleCss } from '#universal/styles/style-primitives.ts'
import { colors, spacing } from '#universal/styles/tokens.ts'
import { detailArticleCss } from '../components/community-detail-sections.tsx'
import { usePackageMappingEditor } from './package-credentials-editor.tsx'
import {
	type PackageTabContext,
	renderCredentialsTab,
	renderMappingsTab,
	renderTriggersTab,
} from './package-credentials-tabs.tsx'
function renderTab(tab: PackageCredentialsTab, context: PackageTabContext) {
	switch (tab) {
		case 'credentials':
			return renderCredentialsTab(context)
		case 'mappings':
			return renderMappingsTab(context)
		case 'triggers':
			return renderTriggersTab(context)
		default: {
			const exhaustive: never = tab
			return exhaustive
		}
	}
}
function packageCredentialsAgentPrompt(input: {
	pageUrl: string
	error: string
}) {
	return [
		`I opened my package's credentials on Kody: ${input.pageUrl}`,
		`Kody said: ${input.error}`,
		'Help me find out why. Do not ask me to paste any credential value into chat.',
	].join('\n')
}
function renderViewError(input: { pageUrl: string; error: string }) {
	return (
		<section
			role="alert"
			data-testid="package-credentials-error"
			css={{
				...cardCss,
				borderLeft: `4px solid ${colors.danger}`,
				justifyItems: 'start',
				gap: spacing.sm,
			}}
		>
			<h2 css={cardTitleCss}>Kody could not load these credentials</h2>
			<p css={{ margin: 0 }}>{input.error}</p>
			<CopyTextButton
				value={packageCredentialsAgentPrompt(input)}
				idleLabel="Copy prompt for your agent"
			/>
		</section>
	)
}
export function PackageCredentialsRoute({
	payload: data,
	currentHref,
}: {
	payload: PackageCredentialsLoaderData
	currentHref: string
}) {
	const client = useQueryClient()
	const { actorKey } = useRouteContext({ from: '__root__' })
	const path = readPackageCredentialsTabPath(
		new URL(currentHref, 'https://kody.local').pathname,
	)
	const shell = data.ok ? data.shell : null
	const username = shell?.username ?? path?.username ?? ''
	const kodyId = shell?.kodyId ?? path?.kodyId ?? ''
	const editor = usePackageMappingEditor(currentHref, {
		readPage: () => ({ username, kodyId, orgSlug: username }),
		onSaved: async (view, postedTo) => {
			const filter = {
				queryKey: ['page', actorKey, 'loadPackageCredentialsPage'],
				predicate: (query: { queryKey: readonly unknown[] }) =>
					typeof query.queryKey[3] === 'string' &&
					query.queryKey[3].startsWith(
						`/@${postedTo.username}/${postedTo.kodyId}/`,
					),
			}
			await client.cancelQueries(filter)
			client.setQueriesData<{
				payload: PackageCredentialsLoaderData
			}>(filter, (cached) =>
				cached?.payload.ok
					? { ...cached, payload: { ...cached.payload, view, viewError: null } }
					: cached,
			)
		},
	})
	if (!path || !data.ok) return <NotFoundPage />
	const view = data.view
	const pageUrl = currentHref
	return (
		<article css={detailArticleCss} data-testid={`package-${path.tab}`}>
			{renderPackageRepoChrome({
				username,
				kodyId,
				isPrivate: shell?.isPrivate ?? false,
				isListed: shell?.isListed ?? false,
				viewerIsOwner: true,
				viewerCanManage: shell?.viewerCanManage ?? false,
				viewerCanManageAccess: shell?.viewerCanManageAccess ?? false,
				active: path.tab,
				filesHref: getPackageTreeHref({
					username,
					kodyId,
					listingId: shell?.listingId ?? null,
					ref: shell?.defaultBranch || fallbackDefaultBranchName,
				}),
				description: shell?.description ?? '',
				ownerProfilePublic: shell?.ownerProfilePublic ?? true,
				iconUrl: resolvePackageListIconUrl({
					username,
					kodyId,
					listingId: shell?.listingId ?? null,
					listingIconCommit: null,
					publishedCommit: shell?.publishedCommit ?? null,
				}),
				iconName: kodyId,
			})}

			{view
				? renderTab(path.tab, {
						orgSlug: username,
						username,
						kodyId,
						view,
						renderMappingCell: editor.renderCell,
					})
				: null}
			{data && !data.view
				? renderViewError({
						pageUrl,
						error:
							data.viewError ??
							'Kody could not load this package’s credentials.',
					})
				: null}
		</article>
	)
}

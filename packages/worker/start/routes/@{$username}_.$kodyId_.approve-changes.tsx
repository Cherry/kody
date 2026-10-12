/** @jsxImportSource @emotion/react */
import { createFileRoute } from '@tanstack/react-router'
import { loadShareReview } from '#start/server/package-review'
import { PackageShareApproveChangesRoute } from '../pages/package-share-approve-changes.tsx'
import { documentHead } from '../components/document-head.ts'
export const Route = createFileRoute('/@{$username}_/$kodyId_/approve-changes')(
	{
		validateSearch: (search: Record<string, unknown>) => ({
			commit: typeof search.commit === 'string' ? search.commit : undefined,
		}),
		loaderDeps: ({ search }) => search,
		loader: ({ abortController, params, deps }) =>
			loadShareReview({
				signal: abortController.signal,
				data: { ...params, ...deps },
			}),
		head: ({ loaderData }) => documentHead(loaderData?.head),
		component: Page,
	},
)
function Page() {
	const params = Route.useParams()
	return (
		<PackageShareApproveChangesRoute
			key={`${params.username}/${params.kodyId}`}
			{...params}
			payload={Route.useLoaderData().payload}
		/>
	)
}

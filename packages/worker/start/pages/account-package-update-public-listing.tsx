/** @jsxImportSource @emotion/react */
import { useRef, useState } from 'react'
import { usePackageMutation } from '../package-mutation.ts'
import { useSubmitterScope } from '../use-submitter-scope.ts'
import { type AccountPackageDetail } from '#universal/loader-data.ts'
import { updatePublicListingSectionId } from '#universal/update-public-listing.ts'
import { colors, radius, spacing } from '#universal/styles/tokens.ts'
import {
	getPillButtonCss,
	visuallyHiddenCss,
} from '#universal/styles/style-primitives.ts'
export function AccountPackageUpdatePublicListing({
	packageDetail,
}: {
	packageDetail: AccountPackageDetail
}) {
	const mutation = usePackageMutation(packageDetail.id)
	const capture = useSubmitterScope()
	const [name, setName] = useState('')
	const [message, setMessage] = useState<string | null>(null)
	const submitting = useRef(false)
	async function submit() {
		if (submitting.current) return
		if (name.trim() !== packageDetail.kodyId) {
			setMessage(
				`Type ${packageDetail.kodyId} to update the public community listing to the current published commit.`,
			)
			return
		}
		submitting.current = true
		setMessage(null)
		const isCurrent = capture()
		try {
			await mutation.submit({
				action: 'set-visibility',
				visibility: 'public',
				confirmName: name.trim(),
			})
			if (isCurrent()) setName('')
		} catch (error) {
			if (isCurrent())
				setMessage(
					error instanceof Error
						? error.message
						: 'Could not update the public community listing.',
				)
		} finally {
			submitting.current = false
		}
	}
	if (!packageDetail.listingNeedsRepublish) return null
	return (
		<div
			id={updatePublicListingSectionId}
			css={{ display: 'grid', gap: spacing.xs }}
			data-testid="package-update-public-listing"
		>
			<p css={{ margin: 0, color: colors.textMuted }}>
				Publish and promote update the package runtime. The public community
				listing stays on its pinned snapshot until you republish it. Type the
				slug, then update the listing.
			</p>
			<label css={{ display: 'grid', gap: spacing.xs }}>
				<span css={visuallyHiddenCss}>
					Type {packageDetail.kodyId} to update the public listing
				</span>
				<input
					value={name}
					placeholder={packageDetail.kodyId}
					data-testid="package-update-public-listing-confirm"
					css={{
						padding: spacing.sm,
						borderRadius: radius.md,
						border: `1px solid ${colors.border}`,
						backgroundColor: colors.surface,
						color: colors.text,
					}}
					onChange={(event) => setName(event.currentTarget.value)}
				/>
			</label>
			<button
				type="button"
				disabled={mutation.isPending}
				data-testid="package-update-public-listing-submit"
				css={getPillButtonCss()}
				onClick={() => void submit()}
			>
				{mutation.isPending ? 'Updating listing…' : 'Update public listing'}
			</button>
			{message ? (
				<p css={{ margin: 0, color: colors.danger }} role="alert">
					{message}
				</p>
			) : null}
		</div>
	)
}

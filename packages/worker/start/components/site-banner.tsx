/** @jsxImportSource @emotion/react */
import { useId, useRef, useState } from 'react'
import { SiteLink } from './site-link.tsx'
import { renderIcon } from './icon.tsx'
import { type SiteBannerLoaderData } from '#universal/loader-data.ts'
import {
	isSiteBannerId,
	resolveVisibleSiteBanner,
	type SiteBannerLook,
	type SiteBannerView,
} from '#universal/site-banners.ts'
import {
	getGhostButtonCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import {
	defaultSiteBannerIcon,
	siteBannerActionsCss,
	siteBannerBodyCss,
	siteBannerCopyCss,
	siteBannerDismissCss,
	siteBannerIconName,
	siteBannerIconWellCss,
	siteBannerImageCss,
	siteBannerImagePixelSize,
	siteBannerInnerCss,
	siteBannerSeverityTone,
	siteBannerShellCss,
	siteBannerTitleCss,
} from '#client/site-banner-looks.ts'

type SiteBannerFrameProps = {
	banner: SiteBannerView
	onDismiss?: () => void
	preview?: boolean
}

const emptyViewer = {
	loggedIn: false,
	stableUserId: null,
	plan: null,
	isAdmin: false,
} as const

function emptySiteBannerSnapshot(): SiteBannerLoaderData {
	return {
		banner: null,
		candidates: [],
		dismissedIds: [],
		viewer: emptyViewer,
	}
}

export function SiteBanner({
	snapshot = emptySiteBannerSnapshot(),
	location,
}: {
	snapshot?: SiteBannerLoaderData
	location: { pathname: string; searchStr: string }
}) {
	const [extraDismissedIds, setExtraDismissedIds] = useState<Array<string>>([])
	const dismissInFlight = useRef(false)
	async function dismiss(banner: SiteBannerView) {
		if (!banner.dismissible || dismissInFlight.current) return
		dismissInFlight.current = true
		setExtraDismissedIds((ids) => [...ids, banner.id])
		try {
			if (!isSiteBannerId(banner.id)) return
			await fetch('/site-banner-dismiss.json', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ bannerId: banner.id }),
			})
		} catch {
			// Persistence is best effort, matching the existing local dismissal.
		} finally {
			dismissInFlight.current = false
		}
	}
	const banner = resolveVisibleSiteBanner({
		candidates: snapshot.candidates,
		dismissedIds: [...snapshot.dismissedIds, ...extraDismissedIds],
		pathname: location.pathname,
		searchParams: new URLSearchParams(location.searchStr),
		viewer: snapshot.viewer,
	})
	if (!banner) return null
	return (
		<SiteBannerFrame
			banner={banner}
			onDismiss={banner.dismissible ? () => void dismiss(banner) : undefined}
		/>
	)
}

function SiteBannerFrame(props: SiteBannerFrameProps) {
	const ctaButtonCss = getPillButtonCss({ size: 'sm' })
	const secondaryButtonCss = getGhostButtonCss({ size: 'sm' })

	const id = useId()
	const { banner, onDismiss, preview } = props
	const look = banner.look
	const dismissible = Boolean(onDismiss && banner.dismissible)
	const titleId = `${id}-site-banner-title`
	const tone = siteBannerSeverityTone(banner.severity)

	return (
		<section
			data-testid={preview ? `site-banner-preview-${look}` : 'site-banner'}
			data-look={look}
			data-severity={banner.severity}
			aria-labelledby={titleId}
			css={siteBannerShellCss(look, tone)}
		>
			<div css={siteBannerInnerCss(look)}>
				{renderMedia(banner, look, tone)}
				<div css={siteBannerCopyCss(look)}>
					<p id={titleId} css={siteBannerTitleCss(look)}>
						{banner.title}
					</p>
					{banner.body ? (
						<p css={siteBannerBodyCss(look)}>{banner.body}</p>
					) : null}
				</div>
				<div css={siteBannerActionsCss(look)}>
					{banner.ctaHref && banner.ctaLabel ? (
						<SiteLink href={banner.ctaHref} css={ctaButtonCss}>
							{banner.ctaLabel}
						</SiteLink>
					) : null}
					{banner.secondaryHref && banner.secondaryLabel ? (
						<SiteLink href={banner.secondaryHref} css={secondaryButtonCss}>
							{banner.secondaryLabel}
						</SiteLink>
					) : null}
				</div>
				{dismissible ? (
					<button
						type="button"
						aria-label="Dismiss announcement"
						css={siteBannerDismissCss}
						onClick={onDismiss}
					>
						×
					</button>
				) : null}
			</div>
		</section>
	)
}

function renderMedia(
	banner: SiteBannerView,
	look: SiteBannerLook,
	tone: ReturnType<typeof siteBannerSeverityTone>,
) {
	if (banner.imageUrl) {
		const size = siteBannerImagePixelSize(look)
		return (
			<img
				src={banner.imageUrl}
				alt=""
				width={size.width}
				height={size.height}
				css={siteBannerImageCss(look)}
			/>
		)
	}
	return (
		<span aria-hidden="true" css={siteBannerIconWellCss(look, tone)}>
			{renderIcon(
				siteBannerIconName(banner.icon ?? defaultSiteBannerIcon(look)),
			)}
		</span>
	)
}

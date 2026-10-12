/** @jsxImportSource @emotion/react */
import { SiteLink } from '../components/site-link.tsx'
import { useLocation } from '@tanstack/react-router'
import {
	cardCss,
	mutedLinkCss,
	pageDescriptionCss,
	pageEyebrowCss,
	pageHeaderCss,
	pageTitleCss,
	stackedPageCss,
} from '#universal/styles/style-primitives.ts'

export function OAuthCallbackRoute() {
	const search = useLocation({ select: (location) => location.searchStr })
	const params = new URLSearchParams(search)
	const error = params.get('error')
	const description = params.get('error_description')
	const code = params.get('code')
	const state = params.get('state')
	const isError = Boolean(error || description)
	const title = isError ? 'Authorization failed' : 'Authorization completed'
	const message = description || error
	const detail = isError ? message : code

	return (
		<section css={pageCss}>
			<header css={headerCss}>
				<span css={eyebrowCss}>Kody secure connection</span>
				<h1 css={pageTitleCss}>OAuth callback</h1>
				<p css={pageDescriptionCss}>{title}.</p>
			</header>
			{detail ? <pre css={detailCardCss}>{detail}</pre> : null}
			{state ? <p css={pageDescriptionCss}>State: {state}</p> : null}
			<SiteLink href="/" css={mutedLinkCss}>
				Back home
			</SiteLink>
		</section>
	)
}

const pageCss = {
	...stackedPageCss,
	maxWidth: '32rem',
	margin: '0 auto',
}

const headerCss = pageHeaderCss
const eyebrowCss = pageEyebrowCss
const detailCardCss = {
	...cardCss,
	margin: 0,
	whiteSpace: 'pre-wrap' as const,
}

/** @jsxImportSource @emotion/react */
import { type CSSObject } from '@emotion/react'
import {
	mutedLinkCss,
	pageDescriptionCss,
	pageHeaderCss,
	pageTitleCss,
	stackedPageCss,
} from '#universal/styles/style-primitives.ts'

export function SupportRoute() {
	return (
		<section css={pageCss}>
			<header css={pageHeaderCss}>
				<h1 css={pageTitleCss}>Support</h1>
				<p css={pageDescriptionCss}>
					For help with the hosted Kody service at kody.codes, email{' '}
					<a href="mailto:support@kody.codes" css={mutedLinkCss}>
						support@kody.codes
					</a>
					.
				</p>
				<p css={pageDescriptionCss}>
					A lot of what you experience as Kody is the agent you connected —
					ChatGPT, Claude, Cursor, Codex, or another host. If something feels
					off, try the same request with a better model before writing in.
					Stronger models usually get more out of search, packages, and memory.
				</p>
			</header>

			<p css={{ margin: 0 }}>
				<a href="/faq" css={mutedLinkCss}>
					FAQ
				</a>
				{' · '}
				<a href="/discord" css={mutedLinkCss}>
					Discord
				</a>
				{' · '}
				<a href="/privacy" css={mutedLinkCss}>
					Privacy
				</a>
			</p>
		</section>
	)
}

const pageCss: CSSObject = {
	...stackedPageCss,
	maxWidth: '42rem',
	margin: '0 auto',
}

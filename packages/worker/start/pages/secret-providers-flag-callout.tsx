/** @jsxImportSource @emotion/react */
import { SiteLink } from '../components/site-link.tsx'
import { type CSSObject } from '@emotion/react'
import { type ReactNode } from 'react'
import { buildAuthLink } from '#client/auth-links.ts'
import { secretProvidersFlagKey } from '#universal/feature-flags/registry.ts'
import { routes } from '#universal/routes.ts'
import {
	getAccentCalloutCss,
	getPillButtonCss,
} from '#universal/styles/style-primitives.ts'
import { colors } from '#universal/styles/tokens.ts'

const secretProvidersDocsHref = routes.docDetail.href({
	slug: 'secret-providers',
})

export function renderSecretProvidersFlagCallout(input: {
	loggedIn: boolean
	enabled: boolean
}): ReactNode {
	const loginHref = buildAuthLink(routes.login.href(), secretProvidersDocsHref)

	return (
		<aside
			data-testid="secret-providers-flag-callout"
			data-flag={secretProvidersFlagKey}
			css={calloutCss}
		>
			<p>
				{input.enabled
					? 'You are trying custom secret providers. They are still behind a feature flag, so they may change or go away.'
					: 'Custom secret providers are behind a feature flag because they may change or go away. Turn them on for your account if you want to try them.'}
			</p>
			{input.enabled ? null : input.loggedIn ? (
				<form
					method="post"
					action={routes.secretProvidersOptInPost.href()}
					css={actionCss}
				>
					<button
						type="submit"
						data-testid="secret-providers-flag-opt-in"
						css={getPillButtonCss({ size: 'sm' })}
					>
						Try secret providers
					</button>
				</form>
			) : (
				<p css={actionCss}>
					<SiteLink
						href={loginHref}
						data-testid="secret-providers-flag-login"
						css={getPillButtonCss({ size: 'sm' })}
					>
						Log in to try it
					</SiteLink>
				</p>
			)}
		</aside>
	)
}

const calloutCss = {
	...getAccentCalloutCss(),
	margin: '0 0 1.4rem',
	maxWidth: '62ch',
	'& p': {
		margin: 0,
		color: colors.text,
	},
} satisfies CSSObject

const actionCss = {
	margin: '0.75rem 0 0',
} satisfies CSSObject

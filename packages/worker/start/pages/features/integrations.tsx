/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { FeatureRelated } from './feature-related.tsx'
import {
	integrationAccountStatus,
	IntegrationsHeroScene,
	IntegrationsReuseScene,
	type IntegrationAccountId,
	type IntegrationEventId,
	type IntegrationPackageId,
} from './integrations-scenes.tsx'
import { IntegrationsSetup } from './integrations-setup.tsx'
export function IntegrationsFeature() {
	const [account, setAccount] = useState<IntegrationAccountId>('work')
	const [event, setEvent] = useState<IntegrationEventId | null>(null)
	const [heroShot, setHeroShot] = useState(0)
	const [selectedPackage, setSelectedPackage] =
		useState<IntegrationPackageId>('brief')
	const [packageShot, setPackageShot] = useState(0)
	return (
		<div className="study integrations">
			<div className="split">
				<div>
					<img
						className="feature-orb"
						src="/images/lantern/kody-primitives-orb-integrations.webp"
						alt=""
						width="80"
						height="80"
					/>
					<h1>
						Connect an account.
						<br />
						<em>Put it to work.</em>
					</h1>
					<p className="lead">
						Keep your service connections in Kody. Use packages to turn that
						access into useful tools and workflows.
					</p>
					<SiteLink className="action" href="/docs/oauth">
						See how setup works
					</SiteLink>
				</div>
				<div>
					<span className="example">Example connection, fictional data</span>
					<IntegrationsHeroScene
						account={account}
						event={event}
						shot={heroShot}
						onAccount={(next) => {
							setAccount(next)
							setEvent(null)
							setHeroShot((value) => value + 1)
						}}
						onEvent={(next) => {
							setEvent(next)
							setHeroShot((value) => value + 1)
						}}
					/>
					<p className="visually-hidden" aria-live="polite">
						{integrationAccountStatus(account, event)}
					</p>
				</div>
			</div>
			<section className="story-section ia-reuse">
				<div className="story-split">
					<div>
						<h2>
							Sign in once.
							<br />
							Put the connection to work.
						</h2>
						<p>
							Your connection supplies the account and its permissions. A
							package supplies the action. Reuse the same saved connection in
							the tools you build.
						</p>
						<p className="ia-note">
							Connecting a service does not install its tools.
						</p>
						<SiteLink href="/features/packages">Explore packages ↗</SiteLink>
					</div>
					<div>
						<span className="example">Example connection, fictional data</span>
						<IntegrationsReuseScene
							selected={selectedPackage}
							shot={packageShot}
							onSelect={(next) => {
								setSelectedPackage(next)
								setPackageShot((value) => value + 1)
							}}
						/>
					</div>
				</div>
			</section>
			<IntegrationsSetup />
			<FeatureRelated
				links={[
					{ href: '/integrations/gmail', label: 'Gmail integration' },
					{ href: '/integrations/slack', label: 'Slack integration' },
					{ href: '/integrations/claude', label: 'Claude integration' },
					{ href: '/features/packages', label: 'Reusable packages' },
				]}
			/>
			<div className="feature-start">
				<SiteLink href="/docs/oauth">Read the OAuth setup guide</SiteLink>
				<SiteLink className="action" href="/onboarding">
					Connect your agent
				</SiteLink>
			</div>
		</div>
	)
}

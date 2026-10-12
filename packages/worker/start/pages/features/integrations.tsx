/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { IntegrationsSetup } from './integrations-setup.tsx'
import { FeatureRelated } from './feature-related.tsx'
const examples = {
	brief: {
		operation: "Read this week's calendar events",
		title: 'Your week, ready to review.',
		copy: "Monday's project review and Thursday's client check-in, collected in one brief.",
	},
	prep: {
		operation: 'Read the next meeting',
		title: 'Walk in prepared.',
		copy: 'Project review, Monday at 09:00. Bring the launch brief and your open questions.',
	},
	planner: {
		operation: "Read today's calendar",
		title: 'Make room for focused work.',
		copy: 'Your next meeting starts at 14:00. Keep the morning open for the launch page.',
	},
}
export function IntegrationsFeature() {
	const [account, setAccount] = useState<'personal' | 'work'>('work')
	const [selectedPackage, setSelectedPackage] =
		useState<keyof typeof examples>('brief')
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
					<div className="switchboard ui-window">
						<div className="service">
							<span className="ui-symbol">G</span>Google
							<span className="ui-state">2 accounts</span>
						</div>
						<div className="accounts">
							<button
								type="button"
								aria-pressed={account === 'personal'}
								onClick={() => {
									setAccount('personal')
								}}
							>
								<strong>google-personal</strong>
								<small>Personal</small>
							</button>
							<button
								type="button"
								aria-pressed={account === 'work'}
								onClick={() => {
									setAccount('work')
								}}
							>
								<strong>google-work</strong>
								<small>Work</small>
							</button>
						</div>
						<div className="wire"></div>
						<div className="calendar" aria-live="polite">
							<small>weekly-brief · Read upcoming events</small>
							<h3>
								{account === 'work'
									? 'alex@company.example'
									: 'alex@personal.example'}
							</h3>
							<p>
								{account === 'work'
									? '09:00 · Project review'
									: '10:00 · Dentist appointment'}
								<br />
								{account === 'work'
									? '14:00 · Client check-in'
									: '18:30 · Dinner with Sam'}
							</p>
						</div>
					</div>
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
					<div className="ia-connection-scene">
						<span className="example">Example connection, fictional data</span>
						<div className="ia-account">
							<span className="ia-account-symbol" aria-hidden="true">
								G
							</span>
							<div>
								<strong>google-work</strong>
								<small>alex@company.example</small>
							</div>
							<span className="ia-label">Saved connection</span>
						</div>
						<svg className="ia-route" viewBox="0 0 560 100" aria-hidden="true">
							<path
								className="ia-track"
								d="M280 0V30Q280 45 260 45H70Q50 45 50 65V100M280 45V100M280 45H490Q510 45 510 65V100"
							/>
							<path className="ia-travel" d="M280 0V100" />
						</svg>
						<fieldset className="ia-package-picker">
							<legend className="ia-sr">
								Choose the example package using google-work
							</legend>
							<label>
								<input
									type="radio"
									name="ia-package"
									value="brief"
									checked={selectedPackage === 'brief'}
									onChange={() => {
										setSelectedPackage('brief')
									}}
								/>
								<span>weekly-brief</span>
							</label>
							<label>
								<input
									type="radio"
									name="ia-package"
									value="prep"
									checked={selectedPackage === 'prep'}
									onChange={() => {
										setSelectedPackage('prep')
									}}
								/>
								<span>meeting-prep</span>
							</label>
							<label>
								<input
									type="radio"
									name="ia-package"
									value="planner"
									checked={selectedPackage === 'planner'}
									onChange={() => {
										setSelectedPackage('planner')
									}}
								/>
								<span>day-planner</span>
							</label>
						</fieldset>
						<div className="ia-output" aria-live="polite">
							<small id="ia-operation">
								{examples[selectedPackage].operation}
							</small>
							<h3 id="ia-output-title">{examples[selectedPackage].title}</h3>
							<p id="ia-output-copy">{examples[selectedPackage].copy}</p>
						</div>
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

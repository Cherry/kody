/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { SecretsVault } from './secrets-vault.tsx'
import { FeatureRelated } from './feature-related.tsx'
import { BuildWithAgentButton } from '../../components/build-with-agent-button.tsx'
const approvals = {
	host: 'An approved destination can receive the credential. An empty host allowlist blocks requests that use secret references.',
	package:
		'Your authored packages and reviewed, adopted forks get use automatically. Other packages need an explicit grant.',
	expiry:
		'An expired secret stays listed, but Kody stops resolving it. This does not revoke the token at the service that issued it.',
}
export function SecretsFeature() {
	const [host, setHost] = useState<'approved' | 'blocked'>('approved')
	const [sent, setSent] = useState(false)
	const [approval, setApproval] = useState<keyof typeof approvals>('host')
	return (
		<div className="study secrets">
			<img
				className="feature-orb"
				src="/images/lantern/kody-primitives-orb-secrets.webp"
				alt=""
				width="80"
				height="80"
			/>
			<h1>
				Your agent can use the key.
				<br />
				<em>It can't read it.</em>
			</h1>
			<p className="lead">
				Give your agent the API access it needs. Kody sends the credential only
				to hosts you approve.
			</p>
			<SiteLink className="action" href="/onboarding">
				Connect your agent
			</SiteLink>
			<div className="boundary ui-stage">
				<div className="envelope ui-window">
					<div className="ui-title">
						<span className="ui-symbol">⌑</span>
						<strong>Agent sees</strong>
						<span className="ui-state">Reference only</span>
					</div>
					<div className="ui-row">
						<small>In prompts</small>
						<code>{'{{secret:<name>}}'}</code>
					</div>
					<div className="ui-row">
						<small>Allowed host</small>
						<code>api.example.com</code>
					</div>
				</div>
				<div className="gate">
					<svg viewBox="0 0 140 80" aria-hidden="true">
						<path className="ui-request-line" d="M4 40H136" />
						<path d="m124 32 12 8-12 8" />
						<rect x="51" y="24" width="34" height="32" rx="5" />
						<path d="M59 24v-6a9 9 0 0 1 18 0v6" />
					</svg>
					<small>Resolved by Kody</small>
				</div>
				<div className="envelope ui-window">
					<div className="ui-title">
						<span className="ui-symbol">↗</span>
						<strong>API request</strong>
					</div>
					<strong id="destination">
						{host === 'approved' ? 'Approved API host' : 'Unapproved host'}
					</strong>
					<div className="ui-row">
						<small>Authorization</small>
						<span id="ui-auth-status">
							{sent && host === 'approved'
								? 'Added at request boundary'
								: 'Not sent'}
						</span>
					</div>
					<p className="result" id="secret-result" role="status">
						{sent
							? host === 'approved'
								? 'Request sent to the approved host.'
								: 'Blocked. This host is not approved.'
							: 'Ready to send an example request.'}
					</p>
				</div>
			</div>
			<div className="controls">
				<button
					type="button"
					aria-pressed={host === 'approved'}
					onClick={() => {
						setHost('approved')
						setSent(false)
					}}
				>
					Approved host
				</button>
				<button
					type="button"
					aria-pressed={host === 'blocked'}
					onClick={() => {
						setHost('blocked')
						setSent(false)
					}}
				>
					Unapproved host
				</button>
				<button
					type="button"
					className="run"
					id="send-request"
					onClick={() => {
						setSent(true)
					}}
				>
					Send example request
				</button>
			</div>
			<p className="smallprint">
				Illustration only. The approved API receives the credential. The agent
				does not.
			</p>
			<section className="story-section">
				<div className="story-split">
					<div>
						<h2>
							Approve the destination.
							<br />
							Control the package.
						</h2>
						<p>
							Host approval decides where a secret may be sent. Package access
							decides which saved packages can use it.
						</p>
						<p>
							Packages you write and forks you adopt after reviewing the source
							get use automatically. Other packages need your approval.
						</p>
						<div className="controls" aria-label="Explore secret approvals">
							<button
								type="button"
								aria-pressed={approval === 'host'}
								onClick={() => {
									setApproval('host')
								}}
							>
								Host approval
							</button>
							<button
								type="button"
								aria-pressed={approval === 'package'}
								onClick={() => {
									setApproval('package')
								}}
							>
								Package access
							</button>
							<button
								type="button"
								aria-pressed={approval === 'expiry'}
								onClick={() => {
									setApproval('expiry')
								}}
							>
								Expiry
							</button>
						</div>
						<p id="ms-approval-copy" role="status">
							{approvals[approval]}
						</p>
						<SiteLink href="/docs/secrets">How approvals work</SiteLink>
					</div>
					<div>
						<div className="ui-window ui-policy">
							<div className="ui-title">
								<span className="ui-symbol">⌑</span>
								<strong>Credential access</strong>
								<span className="ui-state">Example</span>
							</div>
							<div
								className={`ms-slip ui-policy-row ${approval === 'host' ? 'ms-active' : ''}`}
							>
								<span>Allowed host</span>
								<code>api.example.com</code>
								<b>✓</b>
							</div>
							<div
								className={`ms-slip ui-policy-row ${approval === 'package' ? 'ms-active' : ''}`}
							>
								<span>Package</span>
								<code>weekly-brief</code>
								<b>✓</b>
							</div>
							<div
								className={`ms-slip ui-policy-row ${approval === 'expiry' ? 'ms-active' : ''}`}
							>
								<span>Expiry</span>
								<span>Checked before use</span>
								<b>✓</b>
							</div>
						</div>
					</div>
				</div>
			</section>
			<SecretsVault />
			<FeatureRelated
				links={[
					{ href: '/features/integrations', label: 'Service connections' },
					{ href: '/features/packages', label: 'Reusable packages' },
				]}
			/>
			<div className="feature-start">
				<div>
					<h2>Give your agent access to the work.</h2>
					<p>
						Store a credential, approve its destination, and choose which
						packages can use it.
					</p>
					<p>
						<SiteLink href="/docs/secrets">Read the guide</SiteLink>
					</p>
				</div>
				<div className="controls">
					<SiteLink className="action" href="/onboarding">
						Connect your agent
					</SiteLink>
					<BuildWithAgentButton />
				</div>
			</div>
		</div>
	)
}

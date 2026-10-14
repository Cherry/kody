/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { SecretsVault } from './secrets-vault.tsx'
import { FeatureRelated } from './feature-related.tsx'
import {
	SecretsAccessScene,
	SecretsTripScene,
	tripResultCopy,
	type SecretApproval,
	type SecretHost,
} from './secrets-scenes.tsx'
import { BuildWithAgentButton } from '../../components/build-with-agent-button.tsx'
const approvals = {
	host: 'An approved destination can receive the credential. An empty host allowlist blocks requests that use secret references.',
	package:
		'Your authored packages and reviewed, adopted forks get use automatically. Other packages need an explicit grant.',
	expiry:
		'An expired secret stays listed, but Kody stops resolving it. This does not revoke the token at the service that issued it.',
}
export function SecretsFeature() {
	const [host, setHost] = useState<SecretHost>('approved')
	const [sent, setSent] = useState(false)
	const [tripShot, setTripShot] = useState(0)
	const [approval, setApproval] = useState<SecretApproval>('host')
	const [approvalShot, setApprovalShot] = useState(0)
	return (
		<div className="study secrets">
			<div className="split">
				<div>
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
						Give your agent the API access it needs. Kody sends the credential
						only to hosts you approve.
					</p>
					<SiteLink className="action" href="/onboarding">
						Connect your agent
					</SiteLink>
				</div>
				<div className="ms-trip">
					<SecretsTripScene host={host} sent={sent} shot={tripShot} />
					<div className="controls" aria-label="Example request">
						<button
							type="button"
							aria-pressed={host === 'approved'}
							onClick={() => {
								setHost('approved')
								setSent(false)
								setTripShot((value) => value + 1)
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
								setTripShot((value) => value + 1)
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
								setTripShot((value) => value + 1)
							}}
						>
							Send example request
						</button>
					</div>
					<p id="secret-result" role="status">
						{tripResultCopy(host, sent)}
					</p>
					<p className="smallprint">
						Illustration only. The approved API receives the credential. The
						agent does not.
					</p>
				</div>
			</div>
			<section className="story-section">
				<div className="story-split ms-access-split">
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
									setApprovalShot((value) => value + 1)
								}}
							>
								Host approval
							</button>
							<button
								type="button"
								aria-pressed={approval === 'package'}
								onClick={() => {
									setApproval('package')
									setApprovalShot((value) => value + 1)
								}}
							>
								Package access
							</button>
							<button
								type="button"
								aria-pressed={approval === 'expiry'}
								onClick={() => {
									setApproval('expiry')
									setApprovalShot((value) => value + 1)
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
					<SecretsAccessScene approval={approval} shot={approvalShot} />
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

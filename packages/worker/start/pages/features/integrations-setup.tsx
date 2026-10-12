/** @jsxImportSource @emotion/react */
import { SiteLink } from '../../components/site-link.tsx'
export function IntegrationsSetup() {
	return (
		<section className="story-section">
			<div className="story-split">
				<div>
					<h2>
						Connect it.
						<br />
						Check it.
						<br />
						Choose what uses it.
					</h2>
					<ol className="ia-setup">
						<li>
							<strong>Choose the service.</strong>
							<p>Your agent helps find the right authorization setup.</p>
						</li>
						<li>
							<strong>Finish sign-in.</strong>
							<p>
								Use a built-in app when one is available, or register your own
								provider app.
							</p>
						</li>
						<li>
							<strong>Test a small request.</strong>
							<p>Check the connection before building a workflow around it.</p>
						</li>
					</ol>
					<details className="ia-details">
						<summary>What does registering an app involve?</summary>
						<p>
							Create an OAuth app with the provider, add Kody’s redirect URL,
							and enter the client details in Kody. The provider and permissions
							determine the setup.
						</p>
						<SiteLink href="/docs/oauth">Read the OAuth setup guide ↗</SiteLink>
					</details>
				</div>
				<div className="ia-lock-scene">
					<span className="example">Example of a restricted connection</span>
					<svg viewBox="0 0 500 230" className="ia-lock-art" aria-hidden="true">
						<path className="ia-track" d="M38 120H158M340 120H462" />
						<rect
							x="155"
							y="45"
							width="188"
							height="151"
							rx="18"
							fill="var(--selected)"
							stroke="var(--accent)"
							strokeWidth="2"
						/>
						<path
							d="M224 102V82a26 26 0 0 1 52 0v20"
							fill="none"
							stroke="var(--accent)"
							strokeWidth="6"
						/>
						<rect
							x="210"
							y="99"
							width="79"
							height="58"
							rx="9"
							fill="var(--accent)"
						/>
						<circle cx="250" cy="122" r="6" fill="var(--canvas)" />
						<path d="M250 127v13" stroke="var(--canvas)" strokeWidth="5" />
						<path
							d="m389 103 30 17-30 17"
							fill="none"
							stroke="var(--accent)"
							strokeWidth="3"
						/>
					</svg>
					<div className="ia-lock-caption">
						<strong>google-work</strong>
						<span>Specific packages</span>
					</div>
					<div className="ia-grant">
						<span>Allowed package</span>
						<code>gmail-drafts</code>
					</div>
					<div className="ia-grant">
						<span>Published behavior</span>
						<strong>Create a draft for review</strong>
					</div>
					<p>
						Restrict a connection to specific packages. Lock the published
						package too when its behavior needs to stay fixed.
					</p>
					<p className="ia-note">
						A drafts-only package can leave out a send action. Google’s token
						still has the permissions Google issued.
					</p>
					<SiteLink href="/docs/locked-gmail-drafts">
						See the complete Gmail draft setup ↗
					</SiteLink>
				</div>
			</div>
		</section>
	)
}

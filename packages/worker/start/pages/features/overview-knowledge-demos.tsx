/** @jsxImportSource @emotion/react */
import { useState } from 'react'
export function MemoryOverviewDemo() {
	const [found, setFound] = useState(false)
	return (
		<div className="demo" aria-label="Memory example">
			<div className="mini">
				<div className="chrome">
					Writing preference <span>Saved</span>
				</div>
				<strong>
					Lead with the decision.
					<br />
					Keep updates short.
				</strong>
				<div className="receipt" aria-live="polite">
					{found
						? 'Next agent found your project-update preference.'
						: 'Available to your connected agents'}
				</div>
			</div>
			<button
				type="button"
				className="demo-action"
				onClick={() => {
					setFound(true)
				}}
			>
				Try another agent ↗
			</button>
		</div>
	)
}
export function SecretsOverviewDemo() {
	const [sent, setSent] = useState(false)
	return (
		<div className="demo" aria-label="Secrets example">
			<div className="mini">
				<div className="chrome">
					API credential <span>Stored</span>
				</div>
				<div className="masked">••••••••••••</div>
				<div className="kv">
					<span>Allowed host</span>
					<code>api.example.com</code>
				</div>
				<div className="receipt" aria-live="polite">
					{sent
						? 'Credential attached for the approved host.'
						: 'Your agent uses a reference to the key.'}
				</div>
			</div>
			<button
				type="button"
				className="demo-action"
				onClick={() => {
					setSent(true)
				}}
			>
				Send example request ↗
			</button>
		</div>
	)
}
export function PackagesOverviewDemo() {
	const [tab, setTab] = useState('result')
	return (
		<div className="demo" aria-label="Packages example">
			<div className="mini">
				<div className="chrome">
					◇ weekly-brief <span>Published</span>
				</div>
				<div className="tabs">
					<button
						type="button"
						aria-pressed={tab === 'result'}
						onClick={() => {
							setTab('result')
						}}
					>
						Result
					</button>
					<button
						type="button"
						aria-pressed={tab === 'source'}
						onClick={() => {
							setTab('source')
						}}
					>
						Source
					</button>
				</div>
				<pre aria-live="polite">
					{tab === 'source'
						? 'weekly-brief/\n  README.md\n  AGENTS.md\n  src/brief.ts'
						: 'Orchard: design review is ready.\nFieldwork: kickoff is booked.'}
				</pre>
			</div>
		</div>
	)
}

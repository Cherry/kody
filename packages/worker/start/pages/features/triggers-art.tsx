/** @jsxImportSource @emotion/react */
export function TriggerSignalsArt(props: { signal: string }) {
	const { signal } = props
	return (
		<svg
			viewBox="0 0 520 390"
			role="img"
			aria-label="Four possible starting signals feed a package"
		>
			<g className="pt-wire">
				<path
					className={signal === 'webhook' ? 'pt-active' : ''}
					d="M72 55h95q45 0 45 45v95h70"
				/>
				<path
					className={signal === 'inbox' ? 'pt-active' : ''}
					d="M72 145h100q40 0 40 50h70"
				/>
				<path
					className={signal === 'package' ? 'pt-active' : ''}
					d="M72 245h100q40 0 40-50h70"
				/>
				<path
					className={signal === 'clock' ? 'pt-active' : ''}
					d="M72 335h95q45 0 45-45v-95h70"
				/>
			</g>
			<g
				className="pt-signal-icons"
				fill="var(--canvas)"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="52" cy="55" r="26" />
				<path d="m47 43-10 12 10 12m10-24 10 12-10 12" />
				<rect x="25" y="125" width="54" height="40" rx="3" />
				<path d="m25 126 27 23 27-23" />
				<path d="m25 231 27-14 27 14v29l-27 15-27-15Zm0 0 27 15 27-15m-27 15v29" />
				<circle cx="52" cy="335" r="26" />
				<path d="M52 317v19h15" />
				<rect x="282" y="145" width="207" height="100" rx="7" />
			</g>
			<text x="385" y="184" textAnchor="middle">
				Your package
			</text>
			<text x="385" y="211" className="pt-svg-small" textAnchor="middle">
				Saved code, ready to run
			</text>
		</svg>
	)
}
export function TriggerScanArt() {
	return (
		<svg
			viewBox="0 0 520 370"
			role="img"
			aria-label="A scheduled scan ends quietly when clean, or starts an investigation when a flake is found"
		>
			<g fill="none" stroke="currentColor" strokeWidth="2">
				<rect x="153" y="20" width="214" height="62" rx="5" />
				<path d="M260 82v44M260 126l60 45-60 45-60-45z" />
				<path className="pt-clean-path" d="M200 171H100v96" />
				<path className="pt-flake-path" d="M320 171h100v96" />
			</g>
			<text x="260" y="58" textAnchor="middle">
				Scheduled scan
			</text>
			<text x="260" y="177" textAnchor="middle">
				Signal?
			</text>
			<text x="100" y="244" textAnchor="middle">
				Clean
			</text>
			<text x="420" y="244" textAnchor="middle">
				Flake found
			</text>
			<g className="pt-clean-end">
				<path
					d="m86 289 10 10 20-24"
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
				/>
				<text x="100" y="335" textAnchor="middle">
					No notification.
				</text>
			</g>
			<g className="pt-flake-end">
				<rect
					x="398"
					y="273"
					width="44"
					height="35"
					rx="8"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				/>
				<circle cx="411" cy="289" r="3" fill="currentColor" />
				<circle cx="429" cy="289" r="3" fill="currentColor" />
				<path d="M420 273v-9" stroke="currentColor" strokeWidth="2" />
				<text x="420" y="335" textAnchor="middle">
					Investigate.
				</text>
			</g>
		</svg>
	)
}

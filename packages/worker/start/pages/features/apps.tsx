/** @jsxImportSource @emotion/react */
import { useEffect, useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { AppsSharing } from './apps-sharing.tsx'
import { AppsIntake, type Brief } from './apps-intake.tsx'
import { FeatureRelated } from './feature-related.tsx'
import { BuildWithAgentButton } from '../../components/build-with-agent-button.tsx'
const initialBrief: Brief = {
	id: 0,
	name: 'Autumn launch',
	kind: 'Website',
	deadline: 'October 28',
	copy: 'A product page for the new collection.',
}
export function AppsFeature() {
	const [draft, setDraft] = useState({ ...initialBrief })
	const [records, setRecords] = useState<Brief[]>([{ ...initialBrief }])
	const [view, setView] = useState<'form' | 'records' | 'detail'>('form')
	const [opened, setOpened] = useState<Brief | undefined>()
	const [saved, setSaved] = useState(false)
	const [nextId, setNextId] = useState(1)
	useEffect(() => {
		if (view === 'detail')
			document.getElementById('saved-brief-heading')?.focus()
	}, [view, opened])
	function save() {
		if (!draft.name.trim()) return
		const accepted = { ...draft, name: draft.name.trim() }
		setDraft(accepted)
		const exists = records.some((record) => record.id === draft.id)
		setRecords(
			exists
				? records.map((record) => (record.id === draft.id ? accepted : record))
				: [...records, accepted],
		)
		setOpened(accepted)
		setSaved(true)
		setView('detail')
	}
	function newBrief() {
		setNextId((id) => id + 1)
		setDraft({
			id: nextId,
			name: '',
			kind: 'Website',
			deadline: 'No deadline',
			copy: '',
		})
		setView('form')
	}
	function recordList() {
		return records.map((record) => (
			<button
				key={record.id}
				className="ia-record"
				type="button"
				onClick={() => {
					setOpened({ ...record })
					setDraft({ ...record })
					setView('detail')
				}}
			>
				<span>
					<strong>{record.name}</strong>
					<small>
						{record.kind} · {record.deadline}
					</small>
				</span>
				<span>Open brief ↗</span>
			</button>
		))
	}
	return (
		<div className="study apps">
			<div className="split">
				<div>
					<img
						className="feature-orb"
						src="/images/lantern/kody-primitives-orb-apps.webp"
						alt=""
						width="80"
						height="80"
					/>
					<h1>
						Give your work
						<br />
						<em>a place to happen.</em>
					</h1>
					<p className="lead">
						Ask your agent for a tool that fits the job. Kody hosts the app,
						keeps its data, and connects it to the packages you already use.
					</p>
					<SiteLink className="action" href="/onboarding">
						Build an app
					</SiteLink>
				</div>
				<div>
					<span className="example">
						Interactive demo, saved only in this page session
					</span>
					<div className="appwindow ui-window">
						<div className="bar">
							<span>
								<span className="ui-browser-dots" aria-hidden="true">
									● ● ●
								</span>{' '}
								project-intake
							</span>
							<span>Demo app</span>
						</div>
						<div className="appbody" id="intake-demo">
							<div className="tabs" aria-label="Demo views">
								<button
									type="button"
									aria-pressed={view === 'form'}
									onClick={() => {
										setView('form')
									}}
								>
									Intake form
								</button>
								<button
									type="button"
									aria-pressed={view === 'records'}
									onClick={() => {
										setView('records')
									}}
								>
									Saved briefs
								</button>
							</div>
							{view === 'form' ? (
								<AppsIntake
									draft={draft}
									onSave={save}
									onChange={(next) => {
										setDraft(next)
									}}
								/>
							) : view === 'records' ? (
								<div>
									<h3>Saved briefs</h3>
									{recordList()}
								</div>
							) : (
								<div>
									<h3 id="saved-brief-heading" tabIndex={-1}>
										{draft.name}
									</h3>
									<p>
										{draft.kind} · {draft.deadline}
									</p>
									<p>{draft.copy}</p>
									<p role="status">
										{saved ? 'Saved in this demo' : 'Example brief'}
									</p>
									<button
										type="button"
										className="run"
										onClick={() => {
											setView('form')
										}}
									>
										Edit brief
									</button>
									<button type="button" className="run" onClick={newBrief}>
										New brief
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
			<section className="story-section">
				<div className="story-split">
					<div>
						<h2>
							Open it.
							<br />
							Do the thing.
							<br />
							Come back tomorrow.
						</h2>
						<p>
							A brief to collect. A project to update. A small calculator you
							use every week. Give the work a screen of its own, with data that
							stays with the package.
						</p>
						<SiteLink href="/docs/package-apps">How app data works ↗</SiteLink>
					</div>
					<div className="ia-return-scene">
						<svg
							className="ia-return-art"
							viewBox="0 0 560 150"
							aria-hidden="true"
						>
							<path d="M95 100C95 10 460 10 460 100" className="ia-track" />
							<path
								d="m444 85 16 17 15-18"
								fill="none"
								stroke="var(--accent)"
								strokeWidth="3"
							/>
							<g transform="translate(68 70) rotate(-8)">
								<rect
									width="64"
									height="77"
									rx="6"
									fill="var(--selected)"
									stroke="var(--accent)"
								/>
								<path
									d="M16 22h32M16 34h32M16 46h22"
									stroke="var(--accent)"
									strokeWidth="3"
								/>
							</g>
							<g transform="translate(430 75) rotate(7)">
								<rect
									width="64"
									height="77"
									rx="6"
									fill="var(--surface)"
									stroke="var(--accent)"
								/>
								<path
									d="m15 38 12 12 23-25"
									fill="none"
									stroke="var(--accent)"
									strokeWidth="4"
								/>
							</g>
						</svg>
						<div className="ia-saved-head">
							<h3>Saved briefs</h3>
							<span>Page-session demo</span>
						</div>
						<div>{recordList()}</div>
						<p className="ia-note" role="status">
							{saved
								? 'Saved only in this page session.'
								: 'Open the example, or save your own brief above.'}
						</p>
						{opened && (
							<div className="ia-record-detail">
								<h3>{opened.name}</h3>
								<p>
									{opened.kind} · {opened.deadline}
								</p>
								<p>{opened.copy}</p>
								<button
									type="button"
									className="run"
									onClick={() => {
										if (opened) {
											setDraft({ ...opened })
											setView('form')
										}
									}}
								>
									Edit this brief
								</button>
								<SiteLink href="#intake-demo">Go to intake form ↑</SiteLink>
							</div>
						)}
					</div>
				</div>
			</section>
			<AppsSharing />
			<FeatureRelated
				links={[
					{ href: '/features/packages', label: 'Reusable packages' },
					{ href: '/features/triggers', label: 'Triggers and automation' },
				]}
			/>
			<div className="feature-start">
				<div>
					<h2>Build the tool you would open every week.</h2>
					<p>
						Start with a small job, a project intake form, a review queue, or a
						tracker with data worth keeping.
					</p>
					<p>
						<SiteLink href="/docs/package-apps">Read the guide</SiteLink>
					</p>
				</div>
				<div>
					<SiteLink className="action" href="/onboarding">
						Build an app
					</SiteLink>
					<BuildWithAgentButton />
				</div>
			</div>
		</div>
	)
}

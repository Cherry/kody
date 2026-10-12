/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
import { FeatureRelated } from './feature-related.tsx'
import { BuildWithAgentButton } from '../../components/build-with-agent-button.tsx'
const notes = {
	writing: [
		'Writing preference',
		'Lead with the decision.',
		'Draft my weekly update.',
		"We're moving ahead with the new design. Review starts Thursday.",
	],
	projects: [
		'Project name',
		'Website refresh: Orchard.',
		'Help me outline an Orchard update.',
		'Orchard update: what changed on the website, what needs review, and what comes next.',
	],
	people: [
		'People',
		'Morgan is my accountant.',
		'Draft a question for my accountant.',
		'Hi Morgan, which documents should I have ready before our next meeting?',
	],
}
const originalWritingPreference = 'Lead with the decision. Keep updates short.'
const updatedWritingPreference =
	'Include the decision, the reason, and the next step.'
const originalProjectDraft =
	"We're moving ahead with the new design. Review starts Thursday."
const updatedProjectDraft =
	"We're moving ahead with the new design. The review feedback is solid. Next step: begin the review Thursday."
export function MemoryFeature() {
	const [nextAgent, setNextAgent] = useState(true)
	const [note, setNote] = useState<keyof typeof notes>('writing')
	const [updated, setUpdated] = useState(false)
	const writingPreference = updated
		? updatedWritingPreference
		: originalWritingPreference
	return (
		<div className="study memory">
			<div className="split">
				<div>
					<img
						className="feature-orb"
						src="/images/lantern/kody-primitives-orb-memory.webp"
						alt=""
						width="80"
						height="80"
					/>
					<h1>
						New agent.
						<br />
						<em>Same you.</em>
					</h1>
					<p className="lead">
						Save the facts and preferences you keep repeating. Bring them to
						your next connected agent.
					</p>
					<SiteLink className="action" href="/onboarding">
						Connect your agent
					</SiteLink>
					<div className="controls" aria-label="Example agent">
						<button
							type="button"
							aria-pressed={!nextAgent}
							onClick={() => {
								setNextAgent(false)
							}}
						>
							Save in one agent
						</button>
						<button
							type="button"
							aria-pressed={nextAgent}
							onClick={() => {
								setNextAgent(true)
							}}
						>
							Try another agent
						</button>
					</div>
				</div>
				<div className="memory-stack ui-stage">
					<span className="example">
						Example memory, shared between connected agents
					</span>
					<div className="note ui-window">
						<div className="ui-title">
							<span className="ui-symbol">≡</span>
							<strong>Memories</strong>
							<span className="ui-state">Saved</span>
						</div>
						<div className="ui-memory-entry">
							<small>Writing preference</small>
							<blockquote id="ms-hero-note">{writingPreference}</blockquote>
							<footer>
								project updates <span>preference</span>
							</footer>
						</div>
					</div>
					<div className="ui-transfer" aria-hidden="true">
						<span></span>
						<i>↓</i>
						<span></span>
					</div>
					<div className="conversation ui-window" aria-live="polite">
						<h3 id="memory-agent">
							{nextAgent ? 'Your next connected agent' : 'Your first agent'}
						</h3>
						<p id="memory-text">
							{nextAgent
								? 'Help me write a project update using my saved preference.'
								: 'Remember this for my project updates.'}
						</p>
						<p id="memory-result">
							{nextAgent
								? `Relevant memory: ${writingPreference}`
								: 'Saved your writing preference in Kody.'}
						</p>
						{nextAgent && (
							<p>{updated ? updatedProjectDraft : originalProjectDraft}</p>
						)}
					</div>
				</div>
			</div>
			<section className="story-section">
				<div className="story-split">
					<div>
						<h2>A little context goes a long way.</h2>
						<p>
							A writing preference. A project name. The person you mean when you
							say “my accountant.” Keep the details worth carrying into the next
							conversation.
						</p>
						<div className="controls" aria-label="Choose an example memory">
							<button
								type="button"
								aria-pressed={note === 'writing'}
								onClick={() => {
									setNote('writing')
								}}
							>
								Writing
							</button>
							<button
								type="button"
								aria-pressed={note === 'projects'}
								onClick={() => {
									setNote('projects')
								}}
							>
								Projects
							</button>
							<button
								type="button"
								aria-pressed={note === 'people'}
								onClick={() => {
									setNote('people')
								}}
							>
								People
							</button>
						</div>
						<details className="ms-details">
							<summary>How does the right note surface?</summary>
							<p>
								Kody returns a small amount of relevant context when your
								connected agent searches or runs work with a memory hint.
								Memories belong to your account.
							</p>
							<SiteLink href="/docs/memory">
								How memory retrieval works
							</SiteLink>
						</details>
					</div>
					<div className="ms-memory-index">
						<div className="ms-moving-note ui-window ui-record">
							<div className="ui-title">
								<span className="ui-symbol">≡</span>
								<strong id="ms-note-kind">{notes[note][0]}</strong>
								<span className="ui-state">Saved</span>
							</div>
							<p id="ms-note-line">{notes[note][1]}</p>
							<div className="ui-record-meta">
								Available to connected agents
							</div>
						</div>
						<div className="ui-transfer" aria-hidden="true">
							<i>↓</i>
						</div>
						<div className="ms-task-output" aria-live="polite">
							<span className="example">Example draft</span>
							<h3 id="ms-task">{notes[note][2]}</h3>
							<p id="ms-draft">{notes[note][3]}</p>
						</div>
					</div>
				</div>
			</section>
			<section className="story-section">
				<div className="story-split">
					<div className="ms-edit-scene">
						<div className="ui-history">
							<span>Find existing preference</span>
							<span aria-hidden="true">→</span>
							<span>Update saved entry</span>
						</div>
						<div className="ms-live-note">
							<small>Writing preference · local example</small>
							<blockquote id="ms-updated-note">{writingPreference}</blockquote>
						</div>
						<p className="ms-update-status" id="ms-update-status" role="status">
							{updated
								? 'Found your existing writing preference. Updated it to include the decision, the reason, and the next step.'
								: 'The original preference is saved.'}
						</p>
					</div>
					<div>
						<h2>
							Changed your mind?
							<br />
							Change the memory.
						</h2>
						<p>
							Ask your agent to update what it remembers. It checks related
							memories first, then tells you what changed.
						</p>
						<div className="controls">
							<button
								type="button"
								className="run"
								id="ms-update"
								disabled={updated}
								onClick={() => {
									setUpdated(true)
								}}
							>
								Make updates more detailed
							</button>
							<button
								type="button"
								id="ms-reset"
								onClick={() => {
									setUpdated(false)
								}}
							>
								Reset example
							</button>
						</div>
						<p>
							Search your memories, remove what you no longer need, or download
							a JSON copy.
						</p>
						<SiteLink href="/docs/memory">
							How to manage and export memories
						</SiteLink>
					</div>
				</div>
				<div className="ms-next-agent">
					<h3>Take it to your next agent.</h3>
					<div className="ms-prompt-pair">
						<div>
							<label htmlFor="ms-save-prompt">
								In your first connected agent
							</label>
							<textarea
								id="ms-save-prompt"
								readOnly
								value="Save this in Kody memory: for project updates, lead with the decision and keep it short."
							/>
						</div>
						<div>
							<label htmlFor="ms-lookup-prompt">
								In another connected agent
							</label>
							<textarea
								id="ms-lookup-prompt"
								readOnly
								value="Look up my project-update preference in Kody and help me draft an update."
							/>
						</div>
					</div>
				</div>
			</section>
			<FeatureRelated
				links={[
					{
						href: '/use-cases/shared-agent-memory',
						label: 'Shared agent memory use case',
					},
					{ href: '/features/integrations', label: 'Service connections' },
				]}
			/>
			<div className="feature-start">
				<SiteLink href="/docs/memory">Read the memory guide</SiteLink>
				<BuildWithAgentButton />
			</div>
		</div>
	)
}

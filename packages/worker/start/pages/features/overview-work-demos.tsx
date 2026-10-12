/** @jsxImportSource @emotion/react */
import { useState } from 'react'
export function TriggersOverviewDemo() {
	const [ran, setRan] = useState(false)
	return (
		<div className="demo" aria-label="Triggers example">
			<div className="event-flow">
				<div>↗ Purchase received</div>
				<span aria-hidden="true">↓</span>
				<div>ƒ Purchase thanks</div>
				<span aria-hidden="true">↓</span>
				<div aria-live="polite">
					{ran ? '✓ Draft ready for your review' : 'Thank-you draft for review'}
				</div>
			</div>
			<button
				type="button"
				className="demo-action"
				onClick={() => {
					setRan(true)
				}}
			>
				Run example ↗
			</button>
		</div>
	)
}
export function IntegrationsOverviewDemo() {
	const [account, setAccount] = useState('work')
	return (
		<div className="demo" aria-label="Integrations example">
			<div className="mini">
				<div className="chrome">
					Google <span>2 accounts</span>
				</div>
				<button
					type="button"
					className="account"
					aria-pressed={account === 'personal'}
					onClick={() => {
						setAccount('personal')
					}}
				>
					<span>google-personal</span>
					<span>Personal{account === 'personal' ? ' ✓' : ''}</span>
				</button>
				<button
					type="button"
					className="account"
					aria-pressed={account === 'work'}
					onClick={() => {
						setAccount('work')
					}}
				>
					<span>google-work</span>
					<span>Work{account === 'work' ? ' ✓' : ''}</span>
				</button>
				<div className="receipt" aria-live="polite">
					{account === 'work'
						? 'weekly-brief → Work calendar'
						: 'weekly-brief → Personal calendar'}
				</div>
			</div>
		</div>
	)
}
export function AppsOverviewDemo() {
	const [project, setProject] = useState('Autumn launch')
	const [saved, setSaved] = useState('')
	return (
		<div className="demo" aria-label="Apps example">
			<form
				className="mini"
				onSubmit={(event) => {
					event.preventDefault()
					if (!project.trim()) return
					setSaved(project.trim())
				}}
			>
				<div className="chrome">
					● ● ● <span>project-intake</span>
				</div>
				<strong>Project brief</strong>
				<label className="project-field">
					Project name
					<input
						value={project}
						required
						onInput={(event) => {
							setProject(event.currentTarget.value)
						}}
					/>
				</label>
				<button type="submit" className="save">
					Save brief
				</button>
				<div className="receipt" aria-live="polite">
					{saved
						? `Saved “${saved}” in this demo.`
						: 'Interactive example, saved in this page only'}
				</div>
			</form>
		</div>
	)
}

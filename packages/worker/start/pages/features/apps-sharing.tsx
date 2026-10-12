/** @jsxImportSource @emotion/react */
import { useState } from 'react'
import { SiteLink } from '../../components/site-link.tsx'
const roles = {
	Use: 'Can read the source and run the package.',
	Contribute: 'Can read the source, run, and edit the package.',
	Manage:
		'Can read the source, run, edit, publish, delete, and manage access to the package.',
}
export function AppsSharing() {
	const [role, setRole] = useState<keyof typeof roles>('Use')
	return (
		<section className="story-section">
			<div className="story-split">
				<div>
					<h2>
						Share the tool
						<br />
						you made.
					</h2>
					<p>
						Give someone access to the package behind your app. Choose whether
						they can run it, help build it, or manage it with you.
					</p>
					<SiteLink href="/docs/package-sharing">Share a package ↗</SiteLink>
				</div>
				<div className="ia-share-scene">
					<span className="example">Example package access</span>
					<div className="ia-collaborator">
						<span className="ia-avatar" aria-hidden="true">
							M
						</span>
						<div>
							<strong>Morgan</strong>
							<small>project-intake</small>
						</div>
						<label>
							<span className="ia-sr">Morgan’s access</span>
							<select
								value={role}
								onChange={(event) => {
									const next = event.currentTarget.value
									if (
										next === 'Use' ||
										next === 'Contribute' ||
										next === 'Manage'
									)
										setRole(next)
								}}
							>
								<option>Use</option>
								<option>Contribute</option>
								<option>Manage</option>
							</select>
						</label>
					</div>
					<p
						className="ia-role-description"
						id="ia-role-description"
						role="status"
					>
						{roles[role]}
					</p>
					<svg
						className="ia-share-art"
						viewBox="0 0 560 185"
						aria-hidden="true"
					>
						<path className="ia-track" d="M80 140H480" />
						<g className="ia-capability">
							<circle cx="80" cy="80" r="36" />
							<path d="m66 80 10 10 20-23" />
							<text x="80" y="174" textAnchor="middle">
								Read + run
							</text>
						</g>
						<g className="ia-capability" opacity={role === 'Use' ? 0.3 : 1}>
							<circle cx="280" cy="80" r="36" />
							<path d="m265 94 6-18 18-18 12 12-18 18Z" />
							<text x="280" y="174" textAnchor="middle">
								Edit
							</text>
						</g>
						<g className="ia-capability" opacity={role === 'Manage' ? 1 : 0.3}>
							<circle cx="480" cy="80" r="36" />
							<path d="M480 95V64m-12 12 12-12 12 12M464 97h32" />
							<text x="480" y="174" textAnchor="middle">
								Publish + access
							</text>
						</g>
					</svg>
					<p className="ia-note">
						Package access does not reveal secret values.
					</p>
				</div>
			</div>
		</section>
	)
}

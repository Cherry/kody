import { type CSSProperties } from 'react'
import { SiteLink } from './site-link.tsx'
import {
	resolveWithAgentOrder,
	withAgentHref,
	withAgentIconSrc,
	type WithAgent,
} from '#universal/with-agents.ts'

/**
 * Homepage hero row of agent marks, each linking to its `/with/:agent` page.
 * The order is shuffled once on the server (`landingAgentOrder` loader data)
 * so hydrate matches. With JavaScript and motion allowed, a second
 * aria-hidden copy of the list makes the CSS loop seamless; otherwise the
 * row is a plain horizontal scroller. Styles: `.landing-agents` in
 * `public/styles.css`.
 */
export function LandingAgentMarquee({
	order,
}: {
	order?: ReadonlyArray<string> | null
}) {
	const agents = resolveWithAgentOrder(order)
	return (
		<nav className="landing-agents" aria-label="Agents that work with Kody">
			<ul className="landing-agents-track">
				{agents.map((agent) => renderAgent(agent, false))}
				{agents.map((agent) => renderAgent(agent, true))}
			</ul>
		</nav>
	)
}

function renderAgent(agent: WithAgent, loopCopy: boolean) {
	return (
		<li
			key={loopCopy ? `${agent.slug}-loop` : agent.slug}
			className="landing-agents-item"
			aria-hidden={loopCopy ? 'true' : undefined}
		>
			<SiteLink
				href={withAgentHref(agent.slug)}
				className="landing-agent"
				tabIndex={loopCopy ? -1 : undefined}
			>
				<span
					className="landing-agent-icon"
					aria-hidden="true"
					style={
						{
							'--agent-icon': `url(${withAgentIconSrc(agent)})`,
						} as CSSProperties
					}
				></span>
				<span className="landing-agent-name">{agent.name}</span>
			</SiteLink>
		</li>
	)
}

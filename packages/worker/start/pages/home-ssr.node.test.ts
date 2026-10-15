import { createElement } from 'react'
import { expect, test } from 'vitest'
import { renderStartPage } from '../test-support/render-start-page.ts'
import { pickWalkthroughHosts } from '#universal/walkthrough-hosts.ts'
import { withAgents } from '#universal/with-agents.ts'
import { HomeRoute } from './home.tsx'

test('homepage renders agent-led connect links and a deterministic accessible marquee', async () => {
	const html = await renderStartPage(
		createElement(HomeRoute, {
			initialHosts: pickWalkthroughHosts(() => 0),
			landingAgentOrder: ['muse', 'codex', 'cursor'],
			landingHeroVideos: [],
		}),
		'/',
	)
	expect(html).toContain('The <em>shared cloud</em> for your team’s agents')
	expect(html).toContain('Connect your agent')
	expect(html).toContain('href="/docs/connect-your-agent"')
	expect(html).toContain('aria-label="Agents that work with Kody"')
	const marquee =
		html.match(/<nav[^>]*class="landing-agents"[\s\S]*?<\/nav>/)?.[0] ?? ''
	const order = [...marquee.matchAll(/href="\/with\/([^"]+)"/g)].map(
		(match) => match[1],
	)
	expect(order.slice(0, 3)).toEqual(['muse', 'codex', 'cursor'])
	expect(order.slice(withAgents.length, withAgents.length + 3)).toEqual([
		'muse',
		'codex',
		'cursor',
	])
	expect(order).toHaveLength(withAgents.length * 3)
	expect(marquee.match(/tabindex="-1"/g)).toHaveLength(withAgents.length * 2)
	expect(
		marquee.match(
			/aria-hidden="true" class="landing-agents-item"|class="landing-agents-item" aria-hidden="true"/g,
		),
	).toHaveLength(withAgents.length * 2)
	for (const agent of withAgents)
		expect(html).toContain(`href="/with/${agent.slug}"`)
	expect(html).not.toContain('href="/onboarding')
	expect(html).not.toContain('id="primitives"')
	expect(html).toContain('class="landing-pcard"')
	expect(html).toContain('href="/believe"')
	expect(html).toContain('Invisible <em>software</em>')
	expect(html).toContain('What Kody <em>is</em> and <em>is not</em>')
})

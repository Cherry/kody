/** @jsxImportSource @emotion/react */
import { useMatchedPageScope } from '../use-matched-page-scope.ts'
import { LandingPrimitiveCards } from './landing-primitive-cards.tsx'
import { BuildWithAgentButton } from '../components/build-with-agent-button.tsx'
import {
	accountDeletedConfirmationMessage,
	isAccountDeletedHome,
} from '#universal/account-deletion-confirmation.ts'
import { useState, type CSSProperties } from 'react'
import { revealRef } from '../components/reveal.ts'
import { SiteLink } from '../components/site-link.tsx'
import { onboardingPath } from '#client/routes/onboarding-redirect.ts'
import { landingArtAttrs } from '#universal/landing-images.ts'
import { landingFactoryBeats } from '#universal/landing-factory-beats.ts'
import { landingWorldBrands } from '#universal/landing-world-brands.ts'
import { renderIcon } from '../components/icon.tsx'
import { homepageSignupPath } from '#universal/first-touch-attribution.ts'
import { routes } from '#universal/routes.ts'
import {
	landingHeroChooserLabelEmphasis,
	landingHeroChooserLabelLead,
	type LandingHeroVideo as LandingHeroVideoItem,
} from '#universal/landing-hero-copy.ts'
import {
	landingCompareCaption,
	landingCompareWithItems,
	landingCompareWithoutItems,
	landingCompareWithTitle,
	landingCompareWithoutTitle,
	landingHeroHeadlineEmphasis,
	landingHeroHeadlineLead,
	landingHeroLead,
	landingHeroPrimaryCta,
	landingHeroSecondaryCta,
	landingHeroSubheadEmphasis,
	landingHeroSubheadLead,
	landingHeroSubheadTail,
	landingInviteGuestLead,
	landingInviteHeadingEmphasis,
	landingInviteHeadingLead,
	landingInviteSignedInLead,
	landingVsHeading,
	landingVsItems,
} from '#universal/landing-home-copy.ts'
import { publicCreateAccountLabel } from '#universal/public-signup-copy.ts'
import { type WalkthroughHostPick } from '#universal/walkthrough-hosts.ts'
import { LandingHeroAgents } from '../components/landing-hero-agents.tsx'
import { LandingHeroVideo } from '../components/landing-hero-video.tsx'
import {
	LandingPrimitives,
	landingPrimitivesSectionId,
} from '../components/landing-primitives.tsx'
import { LandingTestimonialsCarousel } from '../components/landing-testimonials-carousel.tsx'
import { LandingLoopPlayer } from '../components/landing-loop-player.tsx'
import { WalkthroughHostIntro } from './walkthrough-host-intro.tsx'

/**
 * Public landing page. Cross-agent continuity is the door: H1, compare,
 * primitives, and vs come first. Factory / orbit / videos prove it. Motion
 * is enhance-only (`html.js`) and fully off under `prefers-reduced-motion`.
 *
 * Layout styles live in `public/styles.css` (`.landing-*`) so SSR does not
 * emit a per-node `<style data-rmx>` tag for every marketing block.
 */

const factoryPathSteps = [
	{
		kicker: 'Today',
		title: 'Ad hoc prompt',
		note: 'Same question. More tokens.',
	},
	{
		kicker: 'Save it',
		title: 'A package',
		note: 'Durable software you own.',
	},
	{
		kicker: 'Trigger it',
		title: 'No inference',
		note: 'Cron, webhook, email, or event.',
	},
] as const

const ecosystemPathSteps = [
	{
		kicker: 'Repos',
		title: 'Your git',
		note: 'Isolated, agent-written.',
	},
	{
		kicker: 'Registry',
		title: 'Your npm',
		note: 'Packages you can run.',
	},
	{
		kicker: 'Share',
		title: 'Community',
		note: 'Fork public, publish yours.',
	},
] as const

const ecosystemTriggers = ['Webhook', 'Cron', 'HTTP', 'App'] as const

const communityHref = routes.community.href()
const howItWorksHref = `#${landingPrimitivesSectionId}`

function chipIconStyle(icon: string): CSSProperties {
	return { '--chip-icon': `url("/images/icons/${icon}.svg")` } as CSSProperties
}
export function HomeRoute({
	loggedIn,
	initialHosts,
	landingHeroVideos,
}: {
	loggedIn: boolean
	initialHosts: WalkthroughHostPick
	landingHeroVideos: Array<LandingHeroVideoItem>
}) {
	const { pageLocation: location } = useMatchedPageScope()
	const [walkthroughHosts, setWalkthroughHosts] = useState(initialHosts)
	const isSignedIn = loggedIn
	const connectHref = isSignedIn ? onboardingPath : homepageSignupPath

	return (
		<div>
			{isAccountDeletedHome(location.searchStr) ? (
				<p
					role="status"
					data-testid="account-deleted-notice"
					className="landing-account-deleted"
				>
					{accountDeletedConfirmationMessage}
				</p>
			) : null}
			<section className="landing-hero">
				<div className="landing-hero-intro">
					<h1
						data-rise
						style={{ '--rise': '0' } as CSSProperties}
						className="landing-hero-title"
					>
						{landingHeroHeadlineLead}
						<em>{landingHeroHeadlineEmphasis}</em>
					</h1>
					<h2
						data-rise
						style={{ '--rise': '0.6' } as CSSProperties}
						className="landing-hero-subhead"
					>
						{landingHeroSubheadLead}
						<em>{landingHeroSubheadEmphasis}</em>
						{landingHeroSubheadTail}
					</h2>
					<p
						data-rise
						style={{ '--rise': '1' } as CSSProperties}
						className="landing-hero-lead"
					>
						{landingHeroLead}
					</p>
					<div
						data-rise
						style={{ '--rise': '1.4' } as CSSProperties}
						className="landing-hero-actions"
					>
						<SiteLink
							href={connectHref}
							className="landing-pill landing-hero-cta"
						>
							{landingHeroPrimaryCta}
						</SiteLink>
						<BuildWithAgentButton />
						<SiteLink href={howItWorksHref} className="landing-hero-secondary">
							{landingHeroSecondaryCta}
						</SiteLink>
					</div>
				</div>
				<div className="landing-compare">
					<div className="landing-compare-col">
						<h3 id="compare-without-title" className="landing-compare-title">
							{landingCompareWithoutTitle}
						</h3>
						<ul
							aria-labelledby="compare-without-title"
							className="landing-compare-list"
						>
							{landingCompareWithoutItems.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
					<div className="landing-compare-col landing-compare-col-with">
						<h3 id="compare-with-title" className="landing-compare-title">
							{landingCompareWithTitle}
						</h3>
						<ul
							aria-labelledby="compare-with-title"
							className="landing-compare-list"
						>
							{landingCompareWithItems.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
				</div>
				<p className="landing-compare-caption">{landingCompareCaption}</p>
			</section>

			<LandingPrimitives />
			<LandingPrimitiveCards />

			<section aria-labelledby="vs-title" className="landing-vs">
				<h2 id="vs-title" className="landing-section-heading">
					{landingVsHeading}
				</h2>
				<ul className="landing-vs-list">
					{landingVsItems.map((item) => (
						<li key={item.kicker} className="landing-vs-item" ref={revealRef()}>
							<p className="landing-vs-kicker">{item.kicker}</p>
							<p className="landing-vs-body">{item.body}</p>
						</li>
					))}
				</ul>
			</section>

			<section
				id="durable-software"
				aria-labelledby="factory-title"
				className="landing-factory"
			>
				<h2 id="factory-title" className="landing-section-heading">
					From ad hoc prompts to <em>durable software</em>
				</h2>
				<p className="landing-factory-lead">
					Stop re-paying for the same answer. Save the process, then trigger it{' '}
					<strong>without expensive inference</strong>.
				</p>
				<div className="landing-path">
					{renderLandingPathSteps(
						factoryPathSteps,
						'From ad hoc prompt to trigger',
					)}
					<div className="landing-path-stem" aria-hidden="true"></div>
					<ul className="landing-path-fan" aria-label="Example triggers">
						{landingFactoryBeats.map((beat, index) => (
							<li
								key={beat.title}
								className="landing-path-fan-slot"
								ref={revealRef(index * 70)}
							>
								<SiteLink
									href={routes.docDetail.href({ slug: beat.slug })}
									className="landing-path-fan-item landing-path-fan-link"
								>
									<span className="landing-path-kicker">{beat.trigger}</span>
									<span className="landing-path-fan-title">
										{renderIcon(beat.icon, { size: '22' })}
										{beat.title}
									</span>
								</SiteLink>
							</li>
						))}
					</ul>
				</div>
				<p className="landing-factory-ritual">
					<span>Ask once.</span> <span>Save it.</span> <span>Trigger it.</span>
				</p>
			</section>

			<section className="landing-proof">
				<div className="landing-proof-split">
					<LandingHeroAgents hosts={walkthroughHosts ?? undefined} />
					<div className="landing-walkthrough-story notranslate" translate="no">
						<div className="landing-walkthrough-intro">
							{walkthroughHosts ? (
								<WalkthroughHostIntro
									variant="picker"
									hosts={walkthroughHosts}
									onHostsChange={(next) => {
										setWalkthroughHosts(next)
									}}
								/>
							) : null}
						</div>
						<LandingLoopPlayer hosts={walkthroughHosts ?? undefined} />
					</div>
				</div>
			</section>

			<section
				aria-labelledby="testimonials-title"
				className="landing-testimonials"
			>
				<h2 id="testimonials-title" className="landing-section-heading">
					What early builders say
				</h2>
				<p className="landing-testimonials-lead">
					A few notes from people already putting Kody to work with the agents
					they use every day.
				</p>
				<LandingTestimonialsCarousel />
			</section>

			<section aria-labelledby="ecosystem-title" className="landing-ecosystem">
				<div>
					<h2 id="ecosystem-title" className="landing-section-heading">
						Your own <em>git</em> and <em>npm</em>.
					</h2>
					<p className="landing-split-copy">
						An ecosystem for individuals and teams: isolated repos, packages you
						publish, then trigger what you save.
					</p>
					<div className="landing-path landing-path-split">
						{renderLandingPathSteps(
							ecosystemPathSteps,
							'From your git to the community',
						)}
						<div className="landing-path-stem" aria-hidden="true"></div>
						<ul
							className="landing-path-fan landing-path-fan-chips"
							aria-label="Ways to trigger a package"
						>
							{ecosystemTriggers.map((trigger, index) => (
								<li
									key={trigger}
									className="landing-chip"
									ref={revealRef(index * 40, 'reveal-pop')}
								>
									{trigger}
								</li>
							))}
						</ul>
					</div>
				</div>
				<img
					{...landingArtAttrs('kody-community-packages')}
					alt="Kody handing a wrapped package across a counter of neatly sorted parcels"
					className="landing-ecosystem-art"
					ref={revealRef()}
				/>
			</section>

			{landingHeroVideos.length > 0 ? (
				<section aria-labelledby="videos-title" className="landing-videos">
					<h2 id="videos-title" className="landing-section-heading">
						{landingHeroChooserLabelLead}
						<em>{landingHeroChooserLabelEmphasis}</em>
					</h2>
					<LandingHeroVideo videos={landingHeroVideos} />
				</section>
			) : null}

			<section
				id="invite"
				aria-labelledby="invite-title"
				className="landing-invite"
			>
				<img
					{...landingArtAttrs('kody-greeting')}
					alt="Kody waving hello with an open hand"
					className="landing-invite-art"
				/>
				<h2
					id="invite-title"
					className="landing-section-heading landing-invite-title"
				>
					{landingInviteHeadingLead}
					<em>{landingInviteHeadingEmphasis}</em>
				</h2>
				{isSignedIn ? (
					<div>
						<p className="landing-invite-lead">{landingInviteSignedInLead}</p>
						<p className="landing-invite-cta">
							<SiteLink href={onboardingPath} className="landing-pill">
								{landingHeroPrimaryCta}
							</SiteLink>
						</p>
					</div>
				) : (
					<div>
						<p className="landing-invite-lead">{landingInviteGuestLead}</p>
						<p className="landing-invite-cta">
							<SiteLink href={homepageSignupPath} className="landing-pill">
								{publicCreateAccountLabel}
							</SiteLink>
						</p>
					</div>
				)}
				<ul
					aria-label="Services that work with Kody"
					className="landing-world-cloud landing-invite-tools"
				>
					{landingWorldBrands.map((brand, index) =>
						'href' in brand && brand.href ? (
							<li key={brand.label} className="landing-world-link-item">
								<SiteLink
									href={brand.href}
									className="landing-chip landing-chip-icon landing-chip-link"
									style={chipIconStyle(brand.icon)}
									ref={revealRef(index * 35, 'reveal-pop')}
								>
									{brand.label}
								</SiteLink>
							</li>
						) : (
							<li
								key={brand.label}
								className="landing-chip landing-chip-icon"
								style={chipIconStyle(brand.icon)}
								ref={revealRef(index * 35, 'reveal-pop')}
							>
								{brand.label}
							</li>
						),
					)}
					<li className="landing-world-link-item">
						<SiteLink
							href={communityHref}
							className="landing-chip landing-chip-muted landing-chip-link"
							ref={revealRef(landingWorldBrands.length * 35, 'reveal-pop')}
						>
							Public packages
						</SiteLink>
					</li>
				</ul>
			</section>
		</div>
	)
}

type LandingPathStep = {
	kicker: string
	title: string
	note: string
}

function renderLandingPathSteps(
	steps: ReadonlyArray<LandingPathStep>,
	label: string,
) {
	return (
		<ol className="landing-path-rail" aria-label={label}>
			{steps.map((step, index) => (
				<li
					key={step.title}
					className="landing-path-step"
					ref={revealRef(index * 80)}
				>
					<span className="landing-path-node" aria-hidden="true">
						{index + 1}
					</span>
					<p className="landing-path-kicker">{step.kicker}</p>
					<h3 className="landing-path-label">{step.title}</h3>
					<p className="landing-path-note">{step.note}</p>
				</li>
			))}
		</ol>
	)
}

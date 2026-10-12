/** @jsxImportSource @emotion/react */
import { useEffect, useId, useReducer, useRef, type CSSProperties } from 'react'
import { SiteLink } from './site-link.tsx'
import { docHref } from '#universal/docs-nav.ts'
import {
	landingHomePrimitives,
	landingPrimitivesIntroLead,
	landingPrimitivesMoreLead,
	landingPrimitivesMoreLink,
	type LandingHomePrimitive,
} from '#universal/landing-home-copy.ts'
import {
	landingLanternGlass,
	landingLeaderOrbAnchor,
	landingLeaderOrbExit,
	landingLeaderPath,
	landingLeaderWordAnchor,
	landingPrimitiveColorVar,
	landingPrimitiveIds,
	type LandingPrimitiveId,
} from '#universal/landing-lantern.ts'
import { LandingLantern, hoverPointer } from './landing-lantern.tsx'
import { lanternOrbMotionEvent } from './landing-lantern-motion.ts'

/**
 * Homepage primitives block: the locked intro line, then the five-orb
 * lantern with the five words listed beside it, then the learn-more line.
 * Each orb and each word is a disclosure for the same popover: hover, focus, or click opens one; Escape, blur, and leaving close
 * it. Escape does not move focus, so a hovered trigger stays dismissed
 * instead of reopening on focusin. Opening another primitive dismisses the
 * previous one so :hover and :focus-within cannot stack two panels.
 *
 * Leader lines run from each orb to the colored dot before its word. They
 * are measured from layout and redrawn on resize and font load, so they
 * track wrapping. The overlay is `display: none` on narrow screens
 * and the measurement skips while it is hidden. No-JS keeps the definitions
 * in the document for read-out and simply has no lines.
 */

export const landingPrimitivesSectionId = 'primitives'

const whatIsKodyHref = docHref('what-is-kody')

/** Measure orbs and words, then write the leader paths in section pixels. */
function attachLeaderFollow(node: Element, signal: AbortSignal) {
	const svg = node.querySelector<SVGSVGElement>('.landing-primitives-leaders')
	const stage = node.querySelector<HTMLElement>('.landing-primitives-stage')
	if (!svg || !stage) return
	const words = node.querySelector<HTMLElement>('.landing-primitives-words')
	const lanternArt = node.querySelector<HTMLElement>('.landing-lantern-art')

	const draw = () => {
		if (getComputedStyle(svg).display === 'none') return
		const origin = stage.getBoundingClientRect()
		if (origin.width === 0) return
		svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`)
		if (lanternArt) {
			// Lines run faint inside the glass and come up to full strength
			// as they leave it (see the mask in styles.css).
			const art = lanternArt.getBoundingClientRect()
			svg.style.setProperty(
				'--glass-x',
				`${art.left - origin.left + art.width * landingLanternGlass.x}px`,
			)
			svg.style.setProperty(
				'--glass-y',
				`${art.top - origin.top + art.height * landingLanternGlass.y}px`,
			)
			svg.style.setProperty(
				'--glass-r',
				`${art.width * landingLanternGlass.r}px`,
			)
		}
		for (const id of landingPrimitiveIds) {
			const orb = node.querySelector<HTMLElement>(`[data-orb="${id}"]`)
			const dot = node.querySelector<HTMLElement>(`[data-dot="${id}"]`)
			const leader = svg.querySelector<SVGGElement>(`[data-primitive="${id}"]`)
			if (!orb || !dot || !leader) continue
			const orbRect = orb.getBoundingClientRect()
			const centre = landingLeaderOrbAnchor(orbRect, origin)
			const to = landingLeaderWordAnchor(dot.getBoundingClientRect(), origin)
			const from = landingLeaderOrbExit(centre, to, orbRect.width / 2)
			const d = landingLeaderPath(from, to)
			for (const path of leader.querySelectorAll('path')) {
				path.setAttribute('d', d)
			}
		}
		svg.dataset.ready = ''
	}

	let frame: number | null = null
	const schedule = () => {
		if (frame != null) return
		frame = requestAnimationFrame(() => {
			frame = null
			draw()
		})
	}

	// Same frame as the orb step, so the leaders meet the moving rims.
	node.addEventListener(lanternOrbMotionEvent, draw, { signal })

	const observer = new ResizeObserver(schedule)
	observer.observe(stage)
	if (words) observer.observe(words)
	window.addEventListener('resize', schedule, { signal })
	const narrow = matchMedia('(max-width: 800px)')
	narrow.addEventListener('change', schedule, { signal })
	document.fonts?.ready.then(schedule).catch(() => {})
	schedule()
	signal.addEventListener('abort', () => {
		observer.disconnect()
		if (frame != null) cancelAnimationFrame(frame)
	})
}

function renderLeaders(activeId: LandingPrimitiveId | null) {
	return (
		<svg
			className="landing-primitives-leaders"
			aria-hidden="true"
			focusable={false}
			preserveAspectRatio="none"
		>
			{landingPrimitiveIds.map((id) => (
				<g
					key={id}
					className="landing-leader"
					data-primitive={id}
					data-open={activeId === id ? '' : undefined}
					style={
						{
							'--primitive-color': landingPrimitiveColorVar(id),
						} as CSSProperties
					}
				>
					<path className="landing-leader-halo" fill="none" />
					<path className="landing-leader-base" fill="none" />
					<path className="landing-leader-flow" fill="none" />
				</g>
			))}
		</svg>
	)
}

/** A click that lands this soon after hover or focus opened the same
 *  primitive is the same gesture (tap: focus then click), not a toggle. */
const toggleGraceMs = 400

type DisclosureState = {
	openId: LandingPrimitiveId | null
	dismissedId: LandingPrimitiveId | null
	openedAt: number
}
type DisclosureAction = {
	type: 'open' | 'toggle' | 'close' | 'dismiss' | 'resume'
	id: LandingPrimitiveId
	now: number
}
function disclosureReducer(
	state: DisclosureState,
	action: DisclosureAction,
): DisclosureState {
	const { id, type, now } = action
	if (type === 'resume')
		return state.dismissedId === id ? { ...state, dismissedId: null } : state
	if (
		type === 'dismiss' ||
		(type === 'toggle' &&
			state.openId === id &&
			now - state.openedAt > toggleGraceMs)
	)
		return {
			...state,
			openId: state.openId === id ? null : state.openId,
			dismissedId: id,
		}
	if (type === 'close')
		return state.openId === id ? { ...state, openId: null } : state
	if (state.openId === id) return state
	return {
		openId: id,
		openedAt: now,
		dismissedId:
			state.openId ?? (state.dismissedId === id ? null : state.dismissedId),
	}
}
export function LandingPrimitives() {
	const [{ openId, dismissedId }, dispatch] = useReducer(disclosureReducer, {
		openId: null,
		dismissedId: null,
		openedAt: 0,
	})
	const section = useRef<HTMLElement>(null)
	const idPrefix = useId()
	useEffect(() => {
		if (!section.current) return
		const controller = new AbortController()
		attachLeaderFollow(section.current, controller.signal)
		return () => controller.abort()
	}, [])
	function panelId(id: LandingPrimitiveId) {
		return idPrefix + '-' + id + '-panel'
	}
	function setOpen(id: LandingPrimitiveId) {
		dispatch({ type: 'open', id, now: performance.now() })
	}
	function toggle(id: LandingPrimitiveId) {
		dispatch({ type: 'toggle', id, now: performance.now() })
	}
	function close(id: LandingPrimitiveId) {
		dispatch({ type: 'close', id, now: 0 })
	}
	function dismiss(id: LandingPrimitiveId) {
		dispatch({ type: 'dismiss', id, now: 0 })
	}
	function clearDismissed(id: LandingPrimitiveId) {
		dispatch({ type: 'resume', id, now: 0 })
	}

	return (
		<section
			id={landingPrimitivesSectionId}
			aria-labelledby="primitives-title"
			className="landing-primitives"
			data-active={openId ?? undefined}
			ref={section}
		>
			<h2 id="primitives-title" className="landing-primitives-lead">
				{landingPrimitivesIntroLead}
			</h2>
			<div className="landing-primitives-stage">
				<LandingLantern
					activeId={openId}
					panelId={panelId}
					onOpen={setOpen}
					onToggle={toggle}
					onClose={close}
					onDismiss={dismiss}
					onResume={clearDismissed}
				/>
				{renderLeaders(openId)}
				<ul
					className="landing-primitives-words"
					aria-label="The six primitives"
				>
					{landingHomePrimitives.map((primitive) => (
						<li key={primitive.id} className="landing-primitive-item">
							<LandingPrimitiveWord
								primitive={primitive}
								panelId={panelId(primitive.id)}
								open={openId === primitive.id}
								dismissed={dismissedId === primitive.id}
								onOpen={() => setOpen(primitive.id)}
								onToggle={() => toggle(primitive.id)}
								onClose={() => close(primitive.id)}
								onDismiss={() => dismiss(primitive.id)}
								onResume={() => clearDismissed(primitive.id)}
							/>
						</li>
					))}
				</ul>
			</div>
			<p className="landing-primitives-more">
				{landingPrimitivesMoreLead}{' '}
				<SiteLink href={whatIsKodyHref} className="landing-inline-link">
					{landingPrimitivesMoreLink}
				</SiteLink>
			</p>
		</section>
	)
}

function LandingPrimitiveWord(props: {
	primitive: LandingHomePrimitive
	panelId: string
	open: boolean
	dismissed: boolean
	onOpen: () => void
	onToggle: () => void
	onClose: () => void
	onDismiss: () => void
	onResume: () => void
}) {
	function closeIfLeaving(
		current: EventTarget | null,
		next: EventTarget | null,
	) {
		if (!(current instanceof Element)) return
		if (next instanceof Node && current.contains(next)) return
		props.onClose()
		props.onResume()
	}

	const wordNode = useRef<HTMLSpanElement>(null)
	useEffect(() => {
		const node = wordNode.current
		if (!node) return
		function onKeydown(event: KeyboardEvent) {
			if (
				event.key !== 'Escape' ||
				(!props.open && !node?.matches(':hover, :focus-within'))
			)
				return
			event.preventDefault()
			props.onDismiss()
		}
		document.addEventListener('keydown', onKeydown)
		return () => document.removeEventListener('keydown', onKeydown)
	}, [props])
	const { primitive, panelId, open, dismissed, onOpen } = props
	return (
		<span
			ref={wordNode}
			className="landing-primitive"
			data-open={open ? '' : undefined}
			data-dismissed={dismissed ? '' : undefined}
			style={
				{
					'--primitive-color': landingPrimitiveColorVar(primitive.id),
				} as CSSProperties
			}
			onPointerEnter={(event) => {
				if (hoverPointer(event)) onOpen()
			}}
			onPointerLeave={(event) => {
				if (!hoverPointer(event)) return
				closeIfLeaving(event.currentTarget, event.relatedTarget)
			}}
			onFocus={onOpen}
			onBlur={(event) => {
				closeIfLeaving(event.currentTarget, event.relatedTarget)
			}}
		>
			<span
				className="landing-primitive-dot"
				data-dot={primitive.id}
				aria-hidden="true"
			></span>
			<button
				type="button"
				className="landing-primitive-word"
				data-word={primitive.id}
				aria-expanded={open ? 'true' : 'false'}
				aria-controls={panelId}
				aria-describedby={panelId}
				onClick={() => props.onToggle()}
				onKeyDown={(event) => {
					if (event.key !== 'Escape') return
					event.preventDefault()
					props.onDismiss()
				}}
			>
				{primitive.word}
			</button>
			<span id={panelId} role="tooltip" className="landing-primitive-popover">
				<span className="landing-primitive-popover-title" aria-hidden="true">
					{primitive.word}
				</span>
				{primitive.body}
			</span>
		</span>
	)
}
